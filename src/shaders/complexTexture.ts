import { math } from "../../tiny-graphics-math";
import {
  GPUAddresses,
  tiny,
  Uniforms,
  MaterialRecord,
} from "../../tiny-graphics";
import { affineTransform, VectorKind } from "../utils/math";
import { LightSource } from "../../examples/common-shaders";

export type CplxMats = MaterialRecord & {
  bump_map?: tiny.Texture;
  spec_map?: tiny.Texture;
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
    // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
    return `
      precision highp float;
      const int N_LIGHTS = ${this.lightCount};
      uniform float ambient, diffusivity, specularity, smoothness, bumpiness;
      uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
      uniform float light_attenuation_factors[N_LIGHTS];
      uniform vec4 ambient_color;
      uniform vec3 squared_scale, camera_center;

      // Specifier "varying" means a variable's final value will be passed from the vertex shader
      // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
      // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
      varying vec3 N, vertex_worldspace;

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
    // ********* VERTEX SHADER *********
    return `
      ${this.shared_glsl_code()}
      varying vec2 f_tex_coord;
      attribute vec3 position, normal;
      // Position is expressed in object coordinates.
      attribute vec2 texture_coord;
      attribute vec3 tangent;
      attribute vec3 bitangent;

      uniform mat4 model_transform;
      uniform mat4 projection_camera_model_transform;

      void main(){
        // The vertex's final resting place (in NDCS):
        gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
        // The final normal vector in screen space.
        N = normalize( mat3( model_transform ) * normal / squared_scale);
        vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
        // Turn the per-vertex texture coordinate into an interpolated variable.
        f_tex_coord = texture_coord;
      }
    `;
  }

  fragment_glsl_code() {
    // ********* FRAGMENT SHADER *********
    // A fragment is a pixel that's overlapped by the current triangle.
    // Fragments affect the final image or get discarded due to depth.
    return `
      ${this.shared_glsl_code()}
      varying vec2 f_tex_coord;
      uniform sampler2D texture;
      uniform sampler2D bump_map;
      uniform sampler2D spec_map;

      vec3 approximateTangent(vec3 N, vec3 V) {
        return normalize(cross(N, V));
      }

      vec3 approximateBitangent(vec3 N, vec3 T) {
        return normalize(cross(T, N));
      }

      vec3 perturbNormal(vec3 N, vec3 V, vec4 normalMap) {
        // Get the tangent and bitangent vectors
        vec3 T = normalize(approximateTangent(N, V));
        vec3 B = normalize(approximateBitangent(N, T));

        // Calculate the tangent space matrix
        mat3 TBN = mat3(T, B, N);

        // Transform the normal map values from [0,1] to [-1,1] range
        vec3 mapNormal = normalMap.xyz * 2.0 - 1.0;

        // Transform the normal map from tangent space to world space
        vec3 worldNormal = normalize(TBN * mapNormal);

        // Perturb the original normal using the world space normal
        vec3 perturbedNormal = normalize(N + worldNormal);

        return perturbedNormal;
      }

      void main(){
        // Sample the texture image in the correct place:
        vec4 tex_color = texture2D( texture, f_tex_coord );
        vec4 spec_color = texture2D( spec_map, f_tex_coord );
        vec4 bump_color = texture2D( bump_map, f_tex_coord );
        if( tex_color.w < .01 ) discard;

        // convert spec_color to grayscale
        float spec_intensity = dot(spec_color.rgb, vec3(0.299, 0.587, 0.114));
        // use bump_color and N (which is the normal) to compute a bump map
        vec3 V = normalize( camera_center - vertex_worldspace );
        vec3 N_bumped = mix(N, perturbNormal(N, V, bump_color), bumpiness);

        // Compute an initial (ambient) color:
        gl_FragColor = vec4( (ambient_color * tex_color).xyz * ambient, ambient_color.w * tex_color.w );

        // Compute the final color with contributions from lights:
        gl_FragColor.xyz += phong_model_lights(
          normalize( N_bumped ),
          vertex_worldspace,
          tex_color.xyz,
          spec_intensity
        );
      }
    `;
  }

  private send_material(
    gl: WebGL2RenderingContext,
    gpu: GPUAddresses,
    material: CplxMats,
  ) {
    // send_material(): Send the desired shape-wide material qualities to the
    // graphics card, where they will tweak the Phong lighting formula.
    gl.uniform4fv(gpu.ambient_color, material.ambient_color!);
    gl.uniform1f(gpu.ambient, material.ambient!);
    gl.uniform1f(gpu.diffusivity, material.diffusivity!);
    gl.uniform1f(gpu.specularity, material.specularity!);
    gl.uniform1f(gpu.smoothness, material.smoothness!);
    gl.uniform1f(gpu.bumpiness, material.bumpiness!);

    if (
      material.texture &&
      material.texture.ready &&
      material.bump_map &&
      material.bump_map.ready &&
      material.spec_map &&
      material.spec_map.ready
    ) {
      // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":
      gl.uniform1i(gpu.texture, 0);
      gl.uniform1i(gpu.bump_map, 1);
      gl.uniform1i(gpu.spec_map, 2);
      // For this draw, use the texture image from correct the GPU buffer:
      material.texture.activate(gl, 0);
      material.bump_map.activate(gl, 1);
      material.spec_map.activate(gl, 2);
    }
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
