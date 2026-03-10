import { math } from "../../tiny-graphics-math";
import {
  GPUAddresses,
  tiny,
  Uniforms,
  MaterialRecord,
} from "../../tiny-graphics";
import { affineTransform, VectorKind } from "../utils/math";
import { LightSource } from "../../examples/common-shaders";

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

  ambient?: number;
  diffusivity?: number;
  specularity?: number;
  smoothness?: number;
  bumpiness?: number;
};

export type PhongUniforms = Uniforms & {
  lights: LightSource[];
};

export class ComplexTextured extends tiny.Shader {
  // **Textured_Phong** is a Phong Shader extended to addditionally decal a
  // texture image over the drawn shape, lined up according to the texture
  // coordinates that are stored at each shape vertex.

  constructor(private lightCount = 2) {
    super();
    this.lightCount = lightCount;
  }

  shared_glsl_code() {
    return `
      precision highp float;
      const int N_LIGHTS = ${this.lightCount};
      uniform float ambient, diffusivity, specularity, smoothness, bumpiness;
      uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
      uniform float light_attenuation_factors[N_LIGHTS];
      uniform vec4 ambient_color;
      uniform vec3 squared_scale, camera_center;

      varying vec2 f_tex_coord;
      varying vec3 N, vertex_worldspace;
      varying mat3 TBN;

      // might implement this later (Fresnel): https://stackoverflow.com/a/9901654
      // ***** PHONG SHADING HAPPENS HERE: *****
      vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace, vec3 diffuse_color, float specular_intensity ){
        // phong_model_lights():  Add up the lights' contributions.
        vec3 E = normalize( camera_center - vertex_worldspace );
        vec3 result = vec3( 0.0 );
        for(int i = 0; i < N_LIGHTS; i++) {
          // Lights store homogeneous coords - either a position or vector.  If w is 0, the
          // light will appear directional (uniform direction from all points), and we
          // simply obtain a vector towards the light by directly using the stored value.
          // Otherwise if w is 1 it will appear as a point light -- compute the vector to
          // the point light's location from the current surface point.  In either case,
          // fade (attenuate) the light as the vector needed to reach it gets longer.
          vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz -
                                        light_positions_or_vectors[i].w * vertex_worldspace;
          float distance_to_light = length( surface_to_light_vector );

          vec3 L = normalize( surface_to_light_vector );
          vec3 H = normalize( L + E );
          // Compute the diffuse and specular components from the Phong
          // Reflection Model, using Blinn's "halfway vector" method:
          float diffuse  =      max( dot( N, L ), 0.0 );
          float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
          float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );

          vec3 light_contribution =
            diffuse_color.xyz * light_colors[i].xyz * diffusivity * diffuse +
            light_colors[i].xyz * specular_intensity * specularity * specular;
          result += attenuation * light_contribution;
        } // for loop end

        return result;
      }
    `;
  }

  vertex_glsl_code() {
    return `
      ${this.shared_glsl_code()}
      attribute vec3 position, normal;
      // Position is expressed in object coordinates.
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
        // normal in screen space
        N = normalize( mat3( model_transform ) * normal / squared_scale);

        gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
        
        vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
        // Turn the per-vertex texture coordinate into an interpolated variable.
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

      void main(){
        // Sample the texture image in the correct place:
        vec4 tex_color = texture2D(texture, f_tex_coord);
        vec3 spec_map_color = texture2D(spec_map, f_tex_coord).rgb;
        vec3 bump_color = texture2D(bump_map, f_tex_coord).rgb;

        vec3 diffuse = tex_color.rgb * diffuse_color.rgb;
        float alpha = tex_color.a * diffuse_color.a;
        vec3 spec_color = spec_map_color * specular_color.rgb;

        vec3 tangent_normal = texture2D(bump_map, f_tex_coord).xyz * 2.0 - 1.0;
        vec3 N_bumped = normalize(mix(N, normalize(TBN * tangent_normal), bumpiness));

        gl_FragColor = vec4(
          diffuse * ambient_color.rgb * ambient,
          alpha
        );

        gl_FragColor.xyz += phong_model_lights(
          normalize(N_bumped),
          vertex_worldspace,
          diffuse,
          dot(spec_color, vec3(0.299,0.587,0.114))
        );
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

    // send colors
    gl.uniform4fv(gpu.diffuse_color, material.diffuse_color!);
    gl.uniform4fv(gpu.specular_color, material.specular_color!);
    gl.uniform4fv(gpu.ambient_color, material.ambient_color!);

    // send scalars properties
    gl.uniform1f(gpu.ambient, material.ambient!);
    gl.uniform1f(gpu.diffusivity, material.diffusivity!);
    gl.uniform1f(gpu.specularity, material.specularity!);
    gl.uniform1f(gpu.smoothness, material.smoothness!);
    gl.uniform1f(gpu.bumpiness, material.bumpiness!);

    // notify shader whether texture were actuall loaded
    gl.uniform1i(gpu.use_texture, material.texture ? 1 : 0);
    gl.uniform1i(gpu.use_spec_map, material.spec_map ? 1 : 0);
    gl.uniform1i(gpu.use_bump_map, material.bump_map ? 1 : 0);

    // activate maps (conditionally choose default or provided)
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
    // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:

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

    // Omitting lights will show only the material color, scaled by the ambient term:
    if (!uniforms.lights.length) return;

    const light_positions_flattened = [],
      light_colors_flattened = [];
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
    // Fill in any missing fields in the Material object with custom defaults for this shader:
    const defaults = {
      diffuse_color: math.color(1, 1, 1, 1),
      specular_color: math.color(1, 1, 1, 1),
      ambient_color: math.color(0, 0, 0, 1),
      ambient: 0,
      diffusivity: 1,
      specularity: 1,
      smoothness: 40,
      bumpiness: 1,
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
