import { defs } from "../../examples/common";
import { math } from "../../tiny-graphics-math";
import { MaterialRecord, tiny, Uniforms } from "../../tiny-graphics";
import { SolidColor } from "../shaders/solidColor";
import { ParticleShape } from "../shapes/particleShape";
import { lerp } from "../utils/math";

type ScaleLayerConfig = {
  delay: number;
  lifetime: number;
  fadeInTime: number;
  fadeOutTime: number;
  startRadius: number;
  endRadius: number;
  growthExponent: number;
  alpha: number;
  yOffset: number;
};

type StreakConfig = {
  delay: number;
  lifetime: number;
  fadeOutTime: number;
  count: number;
  speedMin: number;
  speedMax: number;
  lengthMin: number;
  lengthMax: number;
  alpha: number;
};

type SmokeConfig = {
  delay: number;
  fadeInTime: number;
  fadeOutTime: number;
  count: number;
  lifetimeMin: number;
  lifetimeMax: number;
  riseSpeedMin: number;
  riseSpeedMax: number;
  driftSpeedMin: number;
  driftSpeedMax: number;
  startSizeMin: number;
  startSizeMax: number;
  endSizeMin: number;
  endSizeMax: number;
  alpha: number;
};

export type SpawnExplosionOptions = {
  enabled?: Partial<ExplosionLayerToggles>;
  inner?: Partial<ScaleLayerConfig>;
  outer?: Partial<ScaleLayerConfig>;
  gust?: Partial<ScaleLayerConfig>;
  shockwave?: Partial<ScaleLayerConfig>;
  streaks?: Partial<StreakConfig>;
  smoke?: Partial<SmokeConfig>;
};

type ExplosionLayerToggles = {
  inner: boolean;
  outer: boolean;
  gust: boolean;
  shockwave: boolean;
  streaks: boolean;
  smoke: boolean;
};

type ExplosionStreak = {
  direction: math.Vector3;
  speed: number;
  length: number;
};

type SmokeParticle = {
  direction: math.Vector3;
  riseSpeed: number;
  driftSpeed: number;
  lifetime: number;
  startSize: number;
  endSize: number;
  spin: number;
  rotation: number;
};

type ExplosionConfig = {
  enabled: ExplosionLayerToggles;
  inner: ScaleLayerConfig;
  outer: ScaleLayerConfig;
  gust: ScaleLayerConfig;
  shockwave: ScaleLayerConfig;
  streaks: StreakConfig;
  smoke: SmokeConfig;
};

type ExplosionInstance = {
  position: math.Vector3;
  age: number;
  lifetime: number;
  config: ExplosionConfig;
  streaks: ExplosionStreak[];
  smoke: SmokeParticle[];
  shockwaveRotation: number;
};

type LayerState = {
  localAge: number;
  alpha: number;
  radius: number;
};

class PixelTexture extends tiny.Texture {
  copy_onto_graphics_card(
    context: WebGL2RenderingContext,
    need_initial_settings = true,
  ) {
    const gpu_instance = super.copy_onto_graphics_card(
      context,
      need_initial_settings,
    );

    const gl = context;
    if (!gpu_instance.texture_buffer_pointer) return gpu_instance;

    gl.bindTexture(gl.TEXTURE_2D, gpu_instance.texture_buffer_pointer);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

    return gpu_instance;
  }
}

export class ExplosionEffect {
  private readonly sphere = new defs.Subdivision_Sphere(4);
  private readonly quad = new defs.Square();
  private readonly streakShape = new ParticleShape(64);
  private readonly texturedShader: defs.Textured_Phong;
  private readonly phongShader: defs.Phong_Shader;
  private readonly solidShader = new SolidColor();

  private readonly textures = {
    explosion: new PixelTexture("../assets/images/explosion/explosion.png"),
    shockwave: new PixelTexture("../assets/images/explosion/Shockwave.png"),
    gust: new PixelTexture("../assets/images/explosion/ShockwaveThin.png"),
    smoke: new PixelTexture("../assets/images/explosion/smokesprite.png"),
  };

  private readonly materials: {
    inner: MaterialRecord;
    outer: MaterialRecord;
    gust: MaterialRecord;
    shockwave: MaterialRecord;
    smoke: MaterialRecord;
    streaks: MaterialRecord & { color: math.Vector4 };
  };

  private instances: ExplosionInstance[] = [];

  constructor(lightCount = 7) {
    this.texturedShader = new defs.Textured_Phong(lightCount);
    this.phongShader = new defs.Phong_Shader(lightCount);
    this.materials = {
      inner: {
        shader: this.texturedShader,
        texture: this.textures.explosion,
        ambient: 1,
        diffusivity: 0.2,
        specularity: 0.1,
        smoothness: 24,
        color: math.color(0.2, 0.1, 0, 1),
      },
      outer: {
        shader: this.phongShader,
        ambient: 0.8,
        diffusivity: 0.15,
        specularity: 0,
        smoothness: 12,
        color: math.color(1, 1, 1, 1),
      },
      gust: {
        shader: this.texturedShader,
        texture: this.textures.gust,
        ambient: 1,
        diffusivity: 0,
        specularity: 0,
        smoothness: 8,
        color: math.color(0, 0, 0, 1),
      },
      shockwave: {
        shader: this.texturedShader,
        texture: this.textures.shockwave,
        ambient: 1,
        diffusivity: 0,
        specularity: 0,
        smoothness: 8,
        color: math.color(0, 0, 0, 1),
      },
      smoke: {
        shader: this.texturedShader,
        texture: this.textures.smoke,
        ambient: 1,
        diffusivity: 0,
        specularity: 0,
        smoothness: 8,
        color: math.color(0, 0, 0, 1),
      },
      streaks: {
        shader: this.solidShader,
        color: math.color(1, 1, 1, 0.6),
      },
    };
  }

  spawn(position: math.Vector3, options?: SpawnExplosionOptions) {
    const config = this.resolveConfig(options);
    const streaks = config.enabled.streaks
      ? this.makeStreaks(config.streaks)
      : [];
    const smoke = config.enabled.smoke ? this.makeSmoke(config.smoke) : [];
    const layerLifetimes: number[] = [];
    if (config.enabled.inner) {
      layerLifetimes.push(config.inner.delay + config.inner.lifetime);
    }
    if (config.enabled.outer) {
      layerLifetimes.push(config.outer.delay + config.outer.lifetime);
    }
    if (config.enabled.gust) {
      layerLifetimes.push(config.gust.delay + config.gust.lifetime);
    }
    if (config.enabled.shockwave) {
      layerLifetimes.push(config.shockwave.delay + config.shockwave.lifetime);
    }
    if (config.enabled.smoke) {
      layerLifetimes.push(config.smoke.delay + config.smoke.lifetimeMax);
    }
    if (config.enabled.streaks) {
      layerLifetimes.push(config.streaks.delay + config.streaks.lifetime);
    }
    const lifetime =
      layerLifetimes.length > 0 ? Math.max(...layerLifetimes) : 0;

    this.instances.push({
      position: math.vec3(position[0], position[1], position[2]),
      age: 0,
      lifetime,
      config,
      streaks,
      smoke,
      shockwaveRotation: Math.random() * Math.PI * 2,
    });
  }

  update(timeDelta: number) {
    for (const fx of this.instances) {
      fx.age += timeDelta;
    }
    this.instances = this.instances.filter((fx) => fx.age < fx.lifetime);
  }

  draw(context: tiny.Component, uniforms: Uniforms) {
    const cameraTransform = uniforms.camera_transform ?? math.Mat4.identity();
    const billboardRotation = this.getBillboardRotation(cameraTransform);

    for (const fx of this.instances) {
      const inner = fx.config.enabled.inner
        ? this.getLayerState(fx.age, fx.config.inner)
        : null;
      if (inner) {
        this.drawSphereLayer(
          context,
          uniforms,
          fx.position,
          inner,
          this.materials.inner,
        );
      }

      const outer = fx.config.enabled.outer
        ? this.getLayerState(fx.age, fx.config.outer)
        : null;
      if (outer) {
        this.drawSphereLayer(
          context,
          uniforms,
          fx.position,
          outer,
          this.materials.outer,
        );
      }

      const gust = fx.config.enabled.gust
        ? this.getLayerState(fx.age, fx.config.gust)
        : null;
      if (gust) {
        const gustTransform = math.Mat4.translation(
          fx.position[0],
          fx.position[1] + fx.config.gust.yOffset,
          fx.position[2],
        )
          .times(billboardRotation)
          .times(math.Mat4.scale(gust.radius, gust.radius, 1));

        this.quad.draw(context, uniforms, gustTransform, {
          ...this.materials.gust,
          color: this.withAlpha(this.materials.gust, gust.alpha),
        });
      }

      const shockwave = fx.config.enabled.shockwave
        ? this.getLayerState(fx.age, fx.config.shockwave)
        : null;
      if (shockwave) {
        const shockY =
          Math.min(fx.position[1], 0.06) + fx.config.shockwave.yOffset;
        const shockTransform = math.Mat4.translation(
          fx.position[0],
          shockY,
          fx.position[2],
        )
          .times(math.Mat4.rotation(Math.PI / 2, 1, 0, 0))
          .times(math.Mat4.rotation(fx.shockwaveRotation, 0, 0, 1))
          .times(math.Mat4.scale(shockwave.radius, shockwave.radius, 1));

        this.quad.draw(context, uniforms, shockTransform, {
          ...this.materials.shockwave,
          color: this.withAlpha(this.materials.shockwave, shockwave.alpha),
        });
      }

      if (fx.config.enabled.streaks) {
        this.drawStreaks(context, uniforms, fx);
      }
      if (fx.config.enabled.smoke) {
        this.drawSmoke(context, uniforms, billboardRotation, fx);
      }
    }
  }

  private drawSphereLayer(
    context: tiny.Component,
    uniforms: Uniforms,
    position: math.Vector3,
    layer: LayerState,
    material: MaterialRecord,
  ) {
    const transform = math.Mat4.translation(
      position[0],
      position[1],
      position[2],
    ).times(math.Mat4.scale(layer.radius, layer.radius, layer.radius));

    this.sphere.draw(context, uniforms, transform, {
      ...material,
      color: this.withAlpha(material, layer.alpha),
    });
  }

  private drawStreaks(
    context: tiny.Component,
    uniforms: Uniforms,
    fx: ExplosionInstance,
  ) {
    const layer = this.getLayerState(fx.age, {
      delay: fx.config.streaks.delay,
      lifetime: fx.config.streaks.lifetime,
      fadeInTime: 0,
      fadeOutTime: fx.config.streaks.fadeOutTime,
      startRadius: 0,
      endRadius: 1,
      growthExponent: 1,
      alpha: fx.config.streaks.alpha,
      yOffset: 0,
    });
    if (!layer) return;

    this.streakShape.clearParticles();
    for (const streak of fx.streaks) {
      const distance = 0.4 + streak.speed * layer.localAge;
      const head = math.vec3(
        fx.position[0] + streak.direction[0] * distance,
        fx.position[1] + streak.direction[1] * distance,
        fx.position[2] + streak.direction[2] * distance,
      );
      const tail = math.vec3(
        head[0] - streak.direction[0] * streak.length,
        head[1] - streak.direction[1] * streak.length,
        head[2] - streak.direction[2] * streak.length,
      );
      this.streakShape.addParticles(head);
      this.streakShape.addParticles(tail);
    }

    this.streakShape.draw(
      context,
      uniforms,
      math.Mat4.identity(),
      {
        ...this.materials.streaks,
        color: math.color(1, 1, 1, Math.max(layer.alpha, 0.2)),
      },
      "LINES",
    );
  }

  private drawSmoke(
    context: tiny.Component,
    uniforms: Uniforms,
    billboardRotation: math.Mat4,
    fx: ExplosionInstance,
  ) {
    for (const smoke of fx.smoke) {
      const age = fx.age - fx.config.smoke.delay;
      if (age < 0 || age > smoke.lifetime) continue;

      const fadeIn =
        fx.config.smoke.fadeInTime <= 0
          ? 1
          : Math.min(1, age / fx.config.smoke.fadeInTime);
      const fadeOut =
        fx.config.smoke.fadeOutTime <= 0
          ? 1
          : Math.min(1, (smoke.lifetime - age) / fx.config.smoke.fadeOutTime);
      const alpha = fx.config.smoke.alpha * Math.min(fadeIn, fadeOut);
      const t = Math.min(1, age / smoke.lifetime);
      const size = lerp(smoke.startSize, smoke.endSize, 1 - Math.pow(1 - t, 2));
      const drift = smoke.driftSpeed * age;
      const rise = smoke.riseSpeed * age;
      const center = math.vec3(
        fx.position[0] + smoke.direction[0] * drift,
        fx.position[1] + rise,
        fx.position[2] + smoke.direction[2] * drift,
      );

      const transform = math.Mat4.translation(center[0], center[1], center[2])
        .times(billboardRotation)
        .times(math.Mat4.rotation(smoke.rotation + smoke.spin * age, 0, 0, 1))
        .times(math.Mat4.scale(size, size, 1));

      this.quad.draw(context, uniforms, transform, {
        ...this.materials.smoke,
        color: this.withAlpha(this.materials.smoke, alpha),
      });
    }
  }

  private withAlpha(material: MaterialRecord, alpha: number) {
    const color =
      (material.color as math.Vector4 | undefined) ?? math.color(1, 1, 1, 1);
    return math.color(color[0], color[1], color[2], alpha);
  }

  private getLayerState(
    age: number,
    config: ScaleLayerConfig,
  ): LayerState | null {
    const localAge = age - config.delay;
    if (localAge < 0 || localAge > config.lifetime) return null;

    const progress = Math.min(1, localAge / config.lifetime);
    const growth = 1 - Math.pow(1 - progress, config.growthExponent);
    const fadeIn =
      config.fadeInTime <= 0 ? 1 : Math.min(1, localAge / config.fadeInTime);
    const fadeOut =
      config.fadeOutTime <= 0
        ? 1
        : Math.min(1, (config.lifetime - localAge) / config.fadeOutTime);

    return {
      localAge,
      alpha: config.alpha * Math.min(fadeIn, fadeOut),
      radius: lerp(config.startRadius, config.endRadius, growth),
    };
  }

  private getBillboardRotation(cameraTransform: math.Mat4): math.Mat4 {
    return math.Matrix.of(
      [cameraTransform[0][0], cameraTransform[0][1], cameraTransform[0][2], 0],
      [cameraTransform[1][0], cameraTransform[1][1], cameraTransform[1][2], 0],
      [cameraTransform[2][0], cameraTransform[2][1], cameraTransform[2][2], 0],
      [0, 0, 0, 1],
    ) as math.Mat4;
  }

  private makeStreaks(config: StreakConfig): ExplosionStreak[] {
    const streaks: ExplosionStreak[] = [];
    for (let i = 0; i < config.count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 0.45;
      const horizontal = Math.sqrt(Math.max(1 - y * y, 0.05));
      streaks.push({
        direction: math.vec3(
          Math.cos(theta) * horizontal,
          y,
          Math.sin(theta) * horizontal,
        ),
        speed: lerp(config.speedMin, config.speedMax, Math.random()),
        length: lerp(config.lengthMin, config.lengthMax, Math.random()),
      });
    }
    return streaks;
  }

  private makeSmoke(config: SmokeConfig): SmokeParticle[] {
    const smoke: SmokeParticle[] = [];
    for (let i = 0; i < config.count; i++) {
      const theta = Math.random() * Math.PI * 2;
      smoke.push({
        direction: math.vec3(Math.cos(theta), 0, Math.sin(theta)),
        riseSpeed: lerp(
          config.riseSpeedMin,
          config.riseSpeedMax,
          Math.random(),
        ),
        driftSpeed: lerp(
          config.driftSpeedMin,
          config.driftSpeedMax,
          Math.random(),
        ),
        lifetime: lerp(config.lifetimeMin, config.lifetimeMax, Math.random()),
        startSize: lerp(
          config.startSizeMin,
          config.startSizeMax,
          Math.random(),
        ),
        endSize: lerp(config.endSizeMin, config.endSizeMax, Math.random()),
        spin: lerp(-0.9, 0.9, Math.random()),
        rotation: Math.random() * Math.PI * 2,
      });
    }
    return smoke;
  }

  private resolveConfig(options?: SpawnExplosionOptions): ExplosionConfig {
    return {
      enabled: {
        inner: true,
        outer: true,
        gust: true,
        shockwave: true,
        streaks: true,
        smoke: true,
        ...(options?.enabled ?? {}),
      },
      inner: {
        delay: 0,
        lifetime: 0.4,
        fadeInTime: 0.02,
        fadeOutTime: 0.2,
        startRadius: 0.15,
        endRadius: 1.3,
        growthExponent: 3.2,
        alpha: 0.95,
        yOffset: 0,
        ...(options?.inner ?? {}),
      },
      outer: {
        delay: 0.07,
        lifetime: 0.58,
        fadeInTime: 0.04,
        fadeOutTime: 0.34,
        startRadius: 0.12,
        endRadius: 2.8,
        growthExponent: 4,
        alpha: 0.08,
        yOffset: 0,
        ...(options?.outer ?? {}),
      },
      gust: {
        delay: 0.06,
        lifetime: 1.2,
        fadeInTime: 0.04,
        fadeOutTime: 0.42,
        startRadius: 0.06,
        endRadius: 5.2,
        growthExponent: 2.4,
        alpha: 0.11,
        yOffset: 0,
        ...(options?.gust ?? {}),
      },
      shockwave: {
        delay: 0.02,
        lifetime: 0.5,
        fadeInTime: 0.01,
        fadeOutTime: 0.12,
        startRadius: 0.16,
        endRadius: 4.8,
        growthExponent: 4.5,
        alpha: 0.25,
        yOffset: 0,
        ...(options?.shockwave ?? {}),
      },
      streaks: {
        delay: 0,
        lifetime: 1,
        fadeOutTime: 0.24,
        count: 12,
        speedMin: 8,
        speedMax: 16,
        lengthMin: 0.45,
        lengthMax: 1.35,
        alpha: 0.48,
        ...(options?.streaks ?? {}),
      },
      smoke: {
        delay: 0.3,
        fadeInTime: 0.15,
        fadeOutTime: 0.45,
        count: 8,
        lifetimeMin: 0.85,
        lifetimeMax: 1.5,
        riseSpeedMin: 0.45,
        riseSpeedMax: 1.2,
        driftSpeedMin: 0.12,
        driftSpeedMax: 0.48,
        startSizeMin: 0.18,
        startSizeMax: 0.3,
        endSizeMin: 0.75,
        endSizeMax: 1.35,
        alpha: 0.7,
        ...(options?.smoke ?? {}),
      },
    };
  }
}
