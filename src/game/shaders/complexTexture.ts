import { math } from "../../tiny-graphics-math";
import {
  GPUAddresses,
  tiny,
  Uniforms,
  MaterialRecord,
} from "../../tiny-graphics";
import { affineTransform, VectorKind } from "../utils/math";
import { LightSource } from "../../libraries/common-shaders";

const DEF_TEXTURES = {
  whiteTexture: createTexture("#ffffff"),
  blackTexture: createTexture("#000000"),
  neutralNormal: createTexture("#8080ff"),
} as const;

export type CplxMats = MaterialRecord & {
  bump_map?: tiny.Texture;
  spec_map?: tiny.Texture;

  diffuse_color?: math.Vector4;
  specular_color?: math.Vector4;
  ambient_color?: math.Vector4;
  fog_color?: math.Vector4;

  ambient?: number;
  diffusivity?: number;
  specularity?: number;
  smoothness?: number;
  bumpiness?: number;

  fog_density?: number;
  shadow_bias?: number;
};

export type PhongUniforms = Uniforms & {
  lights: LightSource[];
  shadow_light_views?: math.Mat4[];
  shadow_light_projections?: math.Mat4[];
  shadow_maps?: (WebGLTexture | null)[];
  shadow_map_sizes?: number[];
  shadow_enabled?: number[];
  shadow_light_positions_or_vectors?: math.Vector4[];
  arena_capsule_a?: math.Vector<2>;
  arena_capsule_b?: math.Vector<2>;
  arena_capsule_radius?: number;
};

export class ComplexTextured extends tiny.Shader {
  constructor(private lightCount = 2) {
    super();
    this.lightCount = lightCount;
  }

  private shadowSamplerUniformDecls(): string {
    return Array.from({ length: this.lightCount }, (_, index) => {
      return `uniform sampler2D shadow_map_${index};`;
    }).join("\n");
  }

  private shadowSamplerLookupFn(): string {
    const lines = ["float sample_shadow_depth(int index, vec2 uv) {"];
    for (let index = 0; index < this.lightCount; index++) {
      const prefix = index === 0 ? "  if" : "  else if";
      lines.push(
        `${prefix} (index == ${index}) return texture2D(shadow_map_${index}, uv).r;`,
      );
    }
    lines.push("  return 1.0;");
    lines.push("}");
    return lines.join("\n");
  }

  shared_glsl_code() {
    return `
      precision highp float;
      precision highp int;
      const int N_LIGHTS = ${this.lightCount};
      uniform float ambient, diffusivity, specularity, smoothness, bumpiness;
      uniform float fog_density;
      uniform float shadow_bias;
      uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
      uniform float light_attenuation_factors[N_LIGHTS];
      uniform vec4 ambient_color;
      uniform mat4 shadow_light_views[N_LIGHTS];
      uniform mat4 shadow_light_projections[N_LIGHTS];
      uniform float shadow_map_sizes[N_LIGHTS];
      uniform int shadow_enabled[N_LIGHTS];
      uniform vec4 shadow_light_positions_or_vectors[N_LIGHTS];
      ${this.shadowSamplerUniformDecls()}
      uniform vec2 arena_capsule_a;
      uniform vec2 arena_capsule_b;
      uniform float arena_capsule_radius;
      uniform vec3 squared_scale, camera_center;

      varying vec2 f_tex_coord;
      varying vec3 N, vertex_worldspace;
      varying mat3 TBN;

      ${this.shadowSamplerLookupFn()}

      float sample_shadow(int light_index, mat4 light_projection, mat4 light_view, float shadow_map_size, vec3 world_pos, vec3 normal, vec3 light_dir);

      float sample_shadow(int light_index, mat4 light_projection, mat4 light_view, float shadow_map_size, vec3 world_pos, vec3 normal, vec3 light_dir) {
        vec2 p = world_pos.xz;
        vec2 pa = p - arena_capsule_a;
        vec2 ba = arena_capsule_b - arena_capsule_a;
        float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        float arena_dist = length(pa - ba * h) - arena_capsule_radius;
        float arena_mask = 1.0 - smoothstep(0.0, 1.0, arena_dist);

        vec4 light_clip = light_projection * light_view * vec4(world_pos, 1.0);
        vec3 proj = light_clip.xyz / light_clip.w;
        vec3 shadow_coord = proj * 0.5 + 0.5;

        if (shadow_coord.x < 0.0 || shadow_coord.x > 1.0 || shadow_coord.y < 0.0 || shadow_coord.y > 1.0 || shadow_coord.z > 1.0) {
          return 1.0;
        }

        float texel_size = 1.0 / max(shadow_map_size, 1.0);
        float bias = max(shadow_bias * (1.0 - max(dot(normalize(normal), normalize(light_dir)), 0.0)), shadow_bias * 0.2);
        float noise = fract(sin(dot(world_pos.xz, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        float current_depth = shadow_coord.z - bias - noise * texel_size * 0.35;

        float visibility = 0.0;
        float weight_sum = 0.0;
        float edge = texel_size * 1.5;
        for (int x = -2; x <= 2; x++) {
          for (int y = -2; y <= 2; y++) {
            float weight = 1.0 / (1.0 + float(x * x + y * y));
            vec2 offset = vec2(float(x), float(y)) * texel_size;
            float map_depth = sample_shadow_depth(light_index, shadow_coord.xy + offset);
            visibility += weight * smoothstep(-edge, edge, map_depth - current_depth);
            weight_sum += weight;
          }
        }

        float shadow_visibility = visibility / max(weight_sum, 0.0001);
        return mix(1.0, shadow_visibility, arena_mask);
      }

      vec3 phong_model_lights( vec3 normal, vec3 world_pos, vec3 diffuse_color, float specular_intensity ){
        vec3 E = normalize( camera_center - world_pos );
        vec3 result = vec3( 0.0 );

        for(int i = 0; i < N_LIGHTS; i++) {
          vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz -
                                        light_positions_or_vectors[i].w * world_pos;
          float distance_to_light = length( surface_to_light_vector );

          vec3 L = normalize( surface_to_light_vector );
          vec3 H = normalize( L + E );
          float diffuse  = max( dot( normal, L ), 0.0 );
          float specular = pow( max( dot( normal, H ), 0.0 ), smoothness );
          float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );

          vec3 light_contribution =
            diffuse_color.xyz * light_colors[i].xyz * diffusivity * diffuse +
            light_colors[i].xyz * specular_intensity * specularity * specular;

          if (shadow_enabled[i] == 1) {
            vec3 light_dir = shadow_light_positions_or_vectors[i].w == 0.0
              ? normalize(shadow_light_positions_or_vectors[i].xyz)
              : normalize(shadow_light_positions_or_vectors[i].xyz - world_pos);
            light_contribution *= sample_shadow(
              i,
              shadow_light_projections[i],
              shadow_light_views[i],
              shadow_map_sizes[i],
              world_pos,
              normal,
              light_dir
            );
          }

          result += attenuation * light_contribution;
        }

        return result;
      }
    `;
  }

  vertex_glsl_code() {
    return `
      ${this.shared_glsl_code()}
      attribute vec3 position, normal;
      attribute vec2 texture_coord;
      attribute vec3 tangent;
      attribute vec3 bitangent;

      uniform mat4 model_transform;
      uniform mat4 projection_camera_model_transform;

      void main(){
        vec3 T = normalize(mat3(model_transform) * tangent);
        vec3 B = normalize(mat3(model_transform) * bitangent);
        vec3 NN = normalize(mat3(model_transform) * normal);

        TBN = mat3(T, B, NN);
        N = normalize( mat3( model_transform ) * normal / squared_scale);

        gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
        vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
        f_tex_coord = texture_coord;
      }
    `;
  }

  fragment_glsl_code() {
    return `
      ${this.shared_glsl_code()}
      uniform sampler2D texture;
      uniform sampler2D bump_map;
      uniform sampler2D spec_map;

      uniform vec4 diffuse_color;
      uniform vec4 specular_color;
      uniform vec4 fog_color;

      void main(){
        vec4 tex_color = texture2D(texture, f_tex_coord);
        vec3 spec_map_color = texture2D(spec_map, f_tex_coord).rgb;

        vec3 diffuse = tex_color.rgb * diffuse_color.rgb;
        float alpha = tex_color.a * diffuse_color.a;
        vec3 spec_color = spec_map_color * specular_color.rgb;

        vec3 tangent_normal = texture2D(bump_map, f_tex_coord).xyz * 2.0 - 1.0;
        vec3 N_bumped = normalize(mix(N, normalize(TBN * tangent_normal), bumpiness));

        vec3 color = 
          diffuse * ambient_color.rgb * ambient +
          phong_model_lights(
            normalize(N_bumped),
            vertex_worldspace,
            diffuse,
            dot(spec_color, vec3(0.299,0.587,0.114))
          );

        float dist = length(camera_center - vertex_worldspace);
        float fog_alpha = fog_color.a;
        float fog = clamp(exp(-0.005 * dist), 0.0, 1.0);
        float fog_inv = 1.0 - fog;
        vec3 final_color = mix(color, fog_color.rgb, fog_alpha * fog_inv);

        gl_FragColor = vec4(final_color, alpha);
      }
    `;
  }

  private send_material(
    gl: WebGL2RenderingContext,
    gpu: GPUAddresses,
    material: CplxMats,
  ) {
    const diffuse = material.texture ?? DEF_TEXTURES.whiteTexture;
    const spec_map = material.spec_map ?? DEF_TEXTURES.whiteTexture;
    const bump_map = material.bump_map ?? DEF_TEXTURES.neutralNormal;

    gl.uniform4fv(gpu.diffuse_color, material.diffuse_color!);
    gl.uniform4fv(gpu.specular_color, material.specular_color!);
    gl.uniform4fv(gpu.ambient_color, material.ambient_color!);
    gl.uniform4fv(gpu.fog_color, material.fog_color!);

    gl.uniform1f(gpu.ambient, material.ambient!);
    gl.uniform1f(gpu.diffusivity, material.diffusivity!);
    gl.uniform1f(gpu.specularity, material.specularity!);
    gl.uniform1f(gpu.smoothness, material.smoothness!);
    gl.uniform1f(gpu.bumpiness, material.bumpiness!);

    gl.uniform1f(gpu.fog_density, material.fog_density!);
    gl.uniform1f(gpu.shadow_bias, material.shadow_bias!);

    gl.uniform1i(gpu.use_texture, material.texture ? 1 : 0);
    gl.uniform1i(gpu.use_spec_map, material.spec_map ? 1 : 0);
    gl.uniform1i(gpu.use_bump_map, material.bump_map ? 1 : 0);

    gl.uniform1i(gpu.texture, 0);
    gl.uniform1i(gpu.bump_map, 1);
    gl.uniform1i(gpu.spec_map, 2);

    diffuse.activate(gl, 0);
    bump_map.activate(gl, 1);
    spec_map.activate(gl, 2);
  }

  private send_uniforms(
    gl: WebGL2RenderingContext,
    gpu: GPUAddresses,
    uniforms: PhongUniforms,
    model_transform: math.Mat4,
  ): void {
    const [xc, yc, zc, ..._] = affineTransform(
      uniforms?.camera_transform!,
      math.vec3(0, 0, 0),
      VectorKind.point,
    );
    const camera_center = math.vec3(xc, yc, zc);

    gl.uniform3fv(gpu.camera_center, camera_center);

    const [sqX, sqY, sqZ] = model_transform.reduce(
      (acc, r) => {
        return [
          acc[0] + r[0] * r[0],
          acc[1] + r[1] * r[1],
          acc[2] + r[2] * r[2],
        ];
      },
      [0, 0, 0],
    );
    gl.uniform3fv(gpu.squared_scale, math.vec3(sqX, sqY, sqZ));

    const PCM = uniforms
      ?.projection_transform!.times(uniforms?.camera_inverse!)
      .times(model_transform);
    gl.uniformMatrix4fv(
      gpu.model_transform,
      false,
      math.Matrix.flatten_2D_to_1D(model_transform.transposed()),
    );
    gl.uniformMatrix4fv(
      gpu.projection_camera_model_transform,
      false,
      math.Matrix.flatten_2D_to_1D(PCM.transposed()),
    );

    const shadowViews: math.Mat4[] = [];
    const shadowProjections: math.Mat4[] = [];
    const shadowEnabled: number[] = [];
    const shadowMapSizes: number[] = [];
    const shadowLightPositions: number[] = [];
    for (let i = 0; i < this.lightCount; i++) {
      shadowViews.push(
        uniforms.shadow_light_views?.[i] ?? math.Mat4.identity(),
      );
      shadowProjections.push(
        uniforms.shadow_light_projections?.[i] ?? math.Mat4.identity(),
      );
      shadowEnabled.push(uniforms.shadow_enabled?.[i] ?? 0);
      shadowMapSizes.push(uniforms.shadow_map_sizes?.[i] ?? 2048);
      const shadowLight =
        uniforms.shadow_light_positions_or_vectors?.[i] ??
        math.vec4(0, 1, 0, 0);
      shadowLightPositions.push(
        shadowLight[0],
        shadowLight[1],
        shadowLight[2],
        shadowLight[3],
      );
    }

    const shadowViewFlat: number[] = [];
    const shadowProjFlat: number[] = [];
    for (let i = 0; i < this.lightCount; i++) {
      shadowViewFlat.push(
        ...math.Matrix.flatten_2D_to_1D(shadowViews[i].transposed()),
      );
      shadowProjFlat.push(
        ...math.Matrix.flatten_2D_to_1D(shadowProjections[i].transposed()),
      );
    }
    gl.uniformMatrix4fv(gpu.shadow_light_views, false, shadowViewFlat);
    gl.uniformMatrix4fv(gpu.shadow_light_projections, false, shadowProjFlat);
    gl.uniform1iv(gpu.shadow_enabled, shadowEnabled);
    gl.uniform1fv(gpu.shadow_map_sizes, shadowMapSizes);
    gl.uniform4fv(gpu.shadow_light_positions_or_vectors, shadowLightPositions);

    gl.uniform2fv(
      gpu.arena_capsule_a,
      uniforms.arena_capsule_a ?? math.Vector.create(0, -22.5),
    );
    gl.uniform2fv(
      gpu.arena_capsule_b,
      uniforms.arena_capsule_b ?? math.Vector.create(0, 22.5),
    );
    gl.uniform1f(gpu.arena_capsule_radius, uniforms.arena_capsule_radius ?? 15);

    for (let i = 0; i < this.lightCount; i++) {
      const texture = uniforms.shadow_maps?.[i] ?? null;
      const textureUnit = 7 + i;
      const gpuAddress = (gpu as unknown as Record<string, number>)[
        `shadow_map_${i}`
      ];
      if (gpuAddress === undefined || textureUnit >= 31) {
        continue;
      }
      gl.uniform1i(gpuAddress, textureUnit);
      gl.activeTexture(gl.TEXTURE0 + textureUnit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    if (!uniforms.lights.length) return;

    const light_positions_flattened = [];
    const light_colors_flattened = [];
    for (let i = 0; i < 4 * uniforms.lights.length; i++) {
      light_positions_flattened.push(
        uniforms.lights[Math.floor(i / 4)].position[i % 4],
      );
      light_colors_flattened.push(
        uniforms.lights[Math.floor(i / 4)].color[i % 4],
      );
    }
    gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
    gl.uniform4fv(gpu.light_colors, light_colors_flattened);
    gl.uniform1fv(
      gpu.light_attenuation_factors,
      uniforms.lights.map((l) => l.attenuation),
    );
  }

  update_GPU(
    context: WebGL2RenderingContext,
    gpu_addresses: GPUAddresses,
    uniforms: PhongUniforms,
    model_transform: math.Mat4,
    material: CplxMats,
  ): void {
    const defaults = {
      diffuse_color: math.color(1, 1, 1, 1),
      specular_color: math.color(1, 1, 1, 1),
      ambient_color: math.color(0, 0, 0, 1),
      fog_color: math.color(0, 0, 0, 0),
      ambient: 0,
      diffusivity: 1,
      specularity: 1,
      smoothness: 40,
      bumpiness: 1,
      fog_density: 0.005,
      shadow_bias: 0.0018,
    };
    material = Object.assign({}, defaults, material);

    this.send_material(context, gpu_addresses, material);
    this.send_uniforms(context, gpu_addresses, uniforms, model_transform);
  }
}

function createTexture(color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 1;

  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);

  return new tiny.Texture(c.toDataURL(), "LINEAR_MIPMAP_LINEAR");
}
