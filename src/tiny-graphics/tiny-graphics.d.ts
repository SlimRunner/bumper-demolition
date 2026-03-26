import type { math as MathNamespace, math } from "@tiny/tiny-graphics-math";
import type { widgets as WidgetsNamespace, widgets } from "@tiny/tiny-graphics-gui";

export type ShapeArrayKeys = "position" | "tangents" | "normal" | (string & {});

export type ShapeArrayTypes = {
  position?: math.Vector3[];
  tangents?: math.Vector3[];
  normal?: math.Vector3[];
  texture_coord?: math.Vector<2>[];
  [key: string]: any;
};

export interface DefaultUniforms {
  camera_inverse: math.Mat4;
  camera_transform: math.Mat4;
  projection_transform: math.Mat4;
  animate: boolean;
  animation_time: number;
  animation_delta_time: number;
}

export interface Uniforms extends Partial<DefaultUniforms> {
  [key: string]: any;
}

export interface ComponentProps {
  uniforms: Uniforms;
  dont_tick?: boolean;
  [key: string]: any;
}

export interface ShapeGPUInstance {
  index_buffer?: WebGLBuffer;
  webGL_buffer_pointers?: Record<string, WebGLBuffer>;
  [key: string]: any;
}

type GPUAddresses = Record<string, WebGLUniformLocation | null>;

export interface ShaderGPUInstance {
  program?: WebGLProgram;
  gpu_addresses?: GPUAddresses;
  vertShdr?: WebGLShader;
  fragShdr?: WebGLShader;
  [key: string]: any;
}

export interface TextureGPUInstance {
  texture_buffer_pointer: WebGLTexture | undefined;
  [key: string]: any;
}

export interface ComponentLayoutOptions {
  show_canvas?: boolean;
  make_controls?: boolean;
  make_code_nav?: boolean;
  make_editor?: boolean;
  [key: string]: any;
}

export type MaterialRecord = {
  shader?: tiny.Shader;
  texture?: tiny.Texture;
} & Record<string, unknown>;

type Constructor<T> = abstract new (...args: any[]) => T;

// ==============================================================

export namespace tiny {
  export class Shape {
    indices: number[];
    gpu_instances: Map<WebGL2RenderingContext, ShapeGPUInstance>;
    arrays: ShapeArrayTypes;

    constructor(...array_names: ShapeArrayKeys[]);

    copy_onto_graphics_card(
      context: WebGL2RenderingContext,
      selection_of_arrays?: ShapeArrayKeys[],
      write_to_indices?: boolean,
    ): ShapeGPUInstance;
    execute_shaders(
      gl: WebGL2RenderingContext,
      gpu_instance: ShapeGPUInstance,
      type: keyof WebGL2RenderingContext,
    ): void;
    draw(
      webgl_manager: Component,
      uniforms: Uniforms,
      model_transform: math.Mat4,
      material: MaterialRecord,
      type?: keyof WebGL2RenderingContext,
    ): void;
    static insert_transformed_copy_into(
      recipient: Shape,
      args: any[],
      points_transform?: math.Mat4,
    ): void;
    make_flat_shaded_version(): abstract new (...args: any[]) => this;
    duplicate_the_shared_vertices(): void;
    flat_shade(): void;
    normalize_positions(keep_aspect_ratios?: boolean): void;
  }

  export class Shader {
    gpu_instances: Map<WebGL2RenderingContext, ShaderGPUInstance>;

    copy_onto_graphics_card(context: WebGL2RenderingContext): ShaderGPUInstance;
    activate(
      context: WebGL2RenderingContext,
      buffer_pointers: Record<string, WebGLBuffer>, // maybe same as ShapeArrayTypes?
      uniforms: Uniforms,
      model_transform: math.Mat4,
      material: MaterialRecord,
    ): void;
    vertex_glsl_code(): string;
    fragment_glsl_code(): string;
    update_GPU(...args: any[]): void;
    static default_values(): DefaultUniforms;
    static assign_camera(camera_inverse: math.Mat4, uniforms: Uniforms): void;
  }

  export class Texture {
    gpu_instances: Map<WebGL2RenderingContext, TextureGPUInstance>;
    filename: string;
    min_filter: keyof WebGL2RenderingContext;
    image: HTMLImageElement;
    ready?: boolean;

    constructor(filename: string, min_filter?: keyof WebGL2RenderingContext);
    copy_onto_graphics_card(
      context: WebGL2RenderingContext,
      need_initial_settings?: boolean,
    ): TextureGPUInstance;
    activate(context: WebGL2RenderingContext, texture_unit?: number): void;
  }

  export class Component {
    props: ComponentProps;
    uniforms: Uniforms;
    animated_children: Component[]; // TODO: verify this is correct?
    document_children: Component[]; // TODO: verify this is correct?
    key_controls: widgets.Keyboard_Manager;
    canvas?: HTMLCanvasElement;
    context?: WebGL2RenderingContext;
    width: number; // these can technically be undefined but that is a pain in the ass
    height: number; // these can technically be undefined but that is a pain in the ass
    controls?: Component; // to appease the mixins

    control_panel?: HTMLDivElement;
    div: HTMLDivElement;
    document_region: HTMLDivElement;
    program_stuff: HTMLDivElement;

    prev_time: number;
    // number from requestAnimationFrame
    event: number;

    widget_options: ComponentLayoutOptions;
    embedded_controls_area: HTMLDivElement;
    embedded_controls: widgets.Controls_Widget;
    embedded_code_nav_area: HTMLDivElement;
    embedded_code_nav: widgets.Controls_Widget;
    embedded_editor_area: HTMLDivElement;
    embedded_editor: widgets.Editor_Widget;

    static types_used_before: Set<Constructor<any>>;

    constructor(props?: ComponentProps);

    static default_uniforms(): DefaultUniforms;
    static initialize_CSS(
      classType: Constructor<any>,
      rules: readonly string[],
    ): void;
    make_context(
      canvas: HTMLCanvasElement,
      background_color?: math.Vector4,
      dimensions?: [number, number],
    ): void;
    set_canvas_size(dimensions?: [number, number]): void;
    frame_advance(time?: number): void;
    new_line(parent?: HTMLElement): void;
    live_string(
      callback: (elem: HTMLDivElement) => void,
      parent?: HTMLElement,
    ): void;
    key_triggered_button(
      description: string,
      shortcut_combination: Array<KeyboardEvent["key"]>,
      callback: (this: Component) => void,
      color?: string,
      release_event?: (this: Component) => void,
      recipient?: Component,
      parent?: HTMLElement,
    ): void;
    render_layout(div: HTMLDivElement, options?: ComponentLayoutOptions): void;
    init(): void;
    render_animation(context: Component): void;
    render_explanation(...args: any[]): void;
    render_controls(...args: any[]): void;
  }

  export const math: typeof MathNamespace;
  export const widgets: typeof WidgetsNamespace;
}
