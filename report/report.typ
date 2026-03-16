#import "libs/helpers.typ": listify, upbold

#set page(
  paper: "a4",
  columns: 2,
  numbering: "1",
)
#set heading(numbering: "1.")

#let doc-meta = (
  author: (
    "Deveaux, Kyle",
    "Flores Martinez, Mario D",
    "Pu, Adrian",
  ),
  date: datetime.today(),
  description: "Final project of course 174C at UCLA",
  keywords: ("tiny-graphics", "shader", "physics", "creative"),
  title: [Bumper Demolition],
)

#set document(
  ..doc-meta,
)
#set par(justify: true)

#place(
  top + center,
  scope: "parent",
  float: true,
  [
    #line(length: 100%)
    #title()
    #line(length: 100%)
    #listify(doc-meta.author, [#h(15mm)], c => text(weight: "bold")[#c])
    #v(0.5cm)
  ],
)

// #heading(numbering: none)[Abstract]

// TODO: do we really need an abstract?

= Introduction

Bumper Demolition is a fast-paced 1v1 multiplayer game set in a circular derby-like arena, where you use armed vehicles to fight to the death! Player can use their roof-mounted saw blade, power-ups, or themselves to blow up the other player.

Each car is equipped with a powerful roof-mounted saw blade that the user can swing down to destroy their opponent.

The game starts with both players looking away from each other with a power-up block in front of them.
There are 2 collectible, time-limited power-ups.

+ Juggernaut: Collecting a yellow box doubles the car's mass and its thrust for a few seconds. Takes less inertia during collisions and thus less damage
+ Particle Barrier: Collecting a purple box provides a time-limited set of spatial orbiting particles. These orbs cause damage to the enemy upon contact and immediately disappear.

The power-ups are randomized, but the first 2 are always Particle Barriers.

Even without the Juggernaut ability, a player can use their car to ram the opponent to pieces. Dealing more damage based on how powerful their ram was.

If all of these tools weren't enough to destroy the other player, after a short time, a sudden death stage begins. A circular laser wall will slowly start to close in, damaging anyone who is outside. The damage increases as the circle gets smaller till a player inevitably loses.





= Requirements

Below are the 4 algorithms that our project fulfilled for the assignment requirements. The systems are explained in more detail in later sections.

+ Articulated Kinematics
+ Mass-Spring-Damper System
+ Collision Detection and Response
+ Particle System

== Articulated Kinematics

Our project includes the mesh of a vehicle with 8 arcs and 8 links. These are

- Chassis with no rotational degrees of freedom (null)
- 2 rear tires, each with 1 rotational degree of freedom
- 2 front tires, each with 2 rotational degrees of freedom
- 2 jointed arms connected each with a single rotational degree of freedom
- 1 saw blade at the end of the jointed arm with 1 degree of freedom

We did not use inverse kinematics. It was all pure animation driven by physics-driven mass-spring-damper frames.

== Mass-Spring-Damper System

The physical world lived entirely inside a single mass-spring-damper system simulation. In order to create the vehicles, we partitioned the buffers of particles and used a tagging system to extract information about specific "clusters" of particles. The buffers are structured as follows:

#align(center, table(
  columns: 3,
  align: (left, left, right),
  table.header([*Cluster*], [*Type*], [*Count*]),
  [Car A], [spring-damper], [26 + 138],
  [Car B], [spring-damper], [26 + 138],
  [Orbits A], [kinematic], [25],
  [Orbits B], [kinematic], [25],
  [Power Ups], [kinematic], [2],
  [Saw Blades], [kinematic], [2],
  [Sparks], [free-dynamic], [100],
))

The frame was designed in Desmos. The particle positions and spring pairs were both hard-coded in the particle manager class from the original design. The spring lengths were simply computed with the Euclidean distance between the particle pairs.

#figure(
  image("images/car-frame.png"),
  caption: [#link("https://www.desmos.com/3d/7dh0kev2zd")[Car Frame]],
)


== Collision Detection and Response

To perform collision detection, we used Signed Distance Functions (SDF for short). They are explained in more detail below, but in summary, these functions allow us to construct non-trivial penetration penalty surfaces that we can apply spring and damper constraints to. The ones we used in our project are the following:

#align(center, table(
  columns: 2,
  align: left,
  table.header([*Type*], [*Purpose*]),
  [plane], [ground],
  [extruded capsule], [arena boundary],
  [oriented box], [vehicles],
))

Each of these also defines a few extra optional parameters, such as tangential friction, traction model (for the tires), and restitution force (for rigid stability). Since these are not easy to visualize during construction, we also used Desmos to design these. The following figure shows a snapshot of the hull around the frame

#figure(
  image("images/frame-sdf-hull.png"),
  caption: [#link("https://www.desmos.com/3d/dak3107drk")[Frame SDF Hull]],
)


== Particle System

=== Orbit Particles

The particle system is baked into the mass-spring-damper system. The only difference is that these particles have no spring attachments and/or ignore physics calculations.

For the orbit particles, we created a slightly randomized orbit as a parametric curve for every orbit particle. The formula is the following:

$
  vec(x(t), y(t), z(t)) = vec(r dot cos(omega t + phi), r dot sin(omega t + phi), h)
$

The radius $r$ is a constant plus some random nudge. The rest, $omega$, $phi$, and $h$, are just random variables in the appropriate ranges.

=== Spark Particles

For the sparks, we made proper physical particles because otherwise they would not look good. These are slightly different from the normal masses in a spring-damper system in that we can dynamically mark them as "disabled" such that they become essentially kinematic particles. The purpose is to dispatch them on command. They inherit the location and velocity of the saw blade particles.

To achieve the natural "spread" of sparks coming out of a saw blade, we used the Gram-Schmidt process (nudge in tangent space), and to get the direction of launch, we used the normalized forward and up vectors of the respective frame. For example, let $upbold(v)_"fwd"$ and $upbold(v)_"up"$ be the forward and up normalized vectors. Then for two random scalars $r_1$ and $r_2$ and an arbitrary coefficient $alpha >= 0$

#[
  #let vf = $upbold(v)_"fwd"$
  #let vu = $upbold(v)_"up"$
  #let vo = $upbold(v)_"out"$
  #let v = upbold($v$)
  #let D = upbold($D$)
  #let T = upbold($T$)
  #let B = upbold($B$)

  $
    #v & = vf + alpha vu \
    #D & = #v / abs(#v) \
    #T & = (#D times vu) / abs(#D times vu) \
    #B & = (#T times #D) / abs(#T times #D) \
  $

  Finally, we get the output vector
  $
    vo & = #D + r_1 #T + r_1 #B \
  $

  We simply add this vector to the initial velocity, override the particle's location and velocity with their new ones, and re-enable the particle. Finally, to dispatch the limited number of particles available, we use a ring buffer (or circular buffer) technique to dynamically recycle particles based on cadence and lifetime.

  Here is a link to a visualization of this in action:
  - #link("https://www.desmos.com/3d/yqwzzdaxa1")
]

=== Explosion and Smoke Particles

When a car drops to zero, an explosion animation will play, and when a car drops below a critical health point threshold, the front of the car will also start billowing smoke. These also feature particles, albeit more primitive. The explosion is composed of spheres, planes, smoke particles, and air streak particles. The smoke from the car uses the same code, just with the other layers of the explosion effect turned off and adjusted settings for lifetime, jitter, size, etc.

The smoke particles slowly increase in size as a function of their lifetime, and their motion is also constant with randomization. Similar to the secondary gust ring (just above the yellow sphere in the explosion), they both use the camera's rotation to always face the camera's direction.
#figure(
  image("images/SmokingCarimage.png"),
  caption: [Smoke particles on car],
)

The air streak particles use the same spark code, except they are significantly simpler, with no physics. They fly out from the center of the sphere and go out radially at random.
#figure(
  image("images/Explosionimage.png"),
  caption: [Explosion decal animation],
)

= System Architecture

We designed our game to be modular. The following describes the major components that put everything together.

== Rendering System <render-system>

We used Tiny-Graphics, but we made several changes to improve upon the limited systems it provided. Two of the most important ones were the OBJ + MTL loader and the custom shaders we built.

Our OBJ parser supports the following flags
#align(center, table(
  columns: 2,
  table.header([*Flag*], [*Description*]),
  [mtllib], [MTL source],
  [usemtl], [material used],
  [v], [vertex list],
  [f], [face groups],
  [vt], [texture coords],
  [vn], [vertex normals],
))

The MTL parser supports these

#align(center, table(
  columns: 2,
  table.header([*Flag*], [*Description*]),
  [newmtl], [declare material],
  [Ns], [specular weight],
  [Ka], [ambient color],
  [Kd], [diffuse color],
  [Ks], [specular color],
  [d], [dissolve (alpha)],
  [Tr], [transparency],
  [map_Kd], [diffuse map],
  [map_Ns], [specular map],
  [map_bump], [normal map],
))

The shaders are explained in more detail in section #ref(<shade-light>). In summary, we made the following:
- `ComplexTextured`: manages three textures for diffuse, specular highlights, and normal mapping. If either is missing, it defaults to a solid color for them (or scalar in the case of specular highlights).
- `SkyboxWH`: uses spherical coordinates and a lookup table to render a realistic skybox
- `SolidColor`: a very simple shader that ignores lighting. It is used to simulate emissive objects
- `SplatShader`: creates light orbs at the positions of each vertex
- `UVShader`: debugging shader to visually inspect that model space normals are correct

=== Pixel Art Textures
Another custom element of the rendering system we developed is the explosion effect. Since the textures have a resolution of 32x32 pixels, they are prone to linear smoothing or averaging of the colors when they are sampled. This often times, causes low pixel count textures to be ruined without proper processing. By default tiny-graphics `Texture` sets it's `TEXTURE_MAG_FILTER` and `TEXTURE_MIN_FILTER` to `LINEAR` and `LINEAR_MIPMAP_LINEAR`. Our custom texture sets the both of these parameters to `gl.NEAREST`. This parameters forces GLSL texture sampler to pick the closest pixel in the picture instead of blending the neighboring pixels, thus preserving the hard edges of pixel textures. Below is the function overload needed to perform this operation.

```ts
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
```

== Physics Simulation

The physics simulation is where we put the most effort. The resulting system was a little bit of a stroke of luck. Originally, our project intended to use rigid body collision, but a few days of iteration proved that it was going to be difficult to implement something brand new that we had never used in practical terms during this course. Thankfully, a visit to the TA gave us the advice we needed to move forward. He suggested that instead of trying to implement rigid collisions, we could reuse our code from the mass-spring-damper coupled with a rigid frame and some way to detect collisions.

This last part was problematic because we did not see how to do that in this course, at least not explicitly, but we had all the tools to sort out this obstacle, too. As it turns out, a penalty constraint usually in the form of a ground plane only needs 2 things to work properly: signed penetration distance and a normal. It was clear that we could use these so-called "signed distance fields" to get arbitrary collider shapes. These functions are usually in the form of primitives. For example, a plane SDF is simply $upbold(v) dot upbold(n) + h$ for some vector $upbold(v)$, the plane normal, and the height. Similar story for circles, prisms, rounded rectangles, boxes, you name it.

However, not all of them are straightforward to derive, but luckily for us, the mathematician and Computer Graphics engineer Inigo Quilez (who incidentally is also the author of Shadertoy) shares a lot of these in his website @quilez-sdf. We took these SDF primitives written in GLSL and translated them into Typescript. The only other burden we had to sort out was figuring out how to dynamically update the collider for the cars, since these obviously cannot be static. They have to move in sync with the car, which means high-frequency math computations.

For this, we created a shared interface for all the SDFs with the following signature

```ts
export interface ContactField {
  affects(p: MSDParticle): boolean;
  sdf(pos: math.Vector3): number;
  normal(pos: math.Vector3, out: math.Vector3): void;
  get group(): Set<string>;
  readonly sdfFunc: FunctorSDF<math.Vector3, number>;

  readonly role: FieldRole;
  stiffness: number;
  damping: number;
  traction: ReactiveTraction | null;
  friction: TangentialFriction | null;
  restitution: ImpulseRestitution | null;
}
```

We called this a `contact` field. With this pattern, we can simply declare the SDF as a parameter in the constructor as a closure that has access to the frame. When it is called from within the mass-spring-damper simulator, it can update its shape on demand to enable car-car collisions.

== Vehicle Model

The vehicle was made by reusing the code we made for assignment 2. We put together the strengths of our projects and made a very flexible framework to manage kinematic chains. Then we made the system more powerful by wrapping the entire construction of a vehicle under one class that accepts high-level parameters like car width, height, tire size, and so on. Also, we pass the meshes we want linked with the arcs and joints, and the rest is computed automatically inside the class.

To make this level of flexibility possible, we had to put some constraints. Namely, we defined what the "standard" sizes of the input shapes must be for the sizes to reflect in the rendered model. We made the following spec

#align(center, table(
  columns: 2,
  align: (left, left),
  table.header([*Part*], [*Mesh*]),
  [arm 1    ], [cylinder],
  [arm 2    ], [cylinder],
  [chassis  ], [cube    ],
  [saw blade], [disc    ],
  [wheels   ], [cylinder],
))

And these are the *base* dimensions expected by `CartArmature`
$
  "cylinder" & -> x: [-1, 1] & , & y: [-1, 1] & , & z: [-1/2, 1/2] \
      "disc" & -> x: [-1, 1] & , & y: [-1, 1] & , & z: [-t, s] \
      "cube" & -> x: [-1, 1] & , & y: [-1, 1] & , & z: [-1, 1] \
$

= Shading & Lighting <shade-light>
// TODO:

Our base class component defines the global number of lights that is going to be used among all the shaders in the project. We used a combination of Tiny-graphics' native `Phong_Shader` and our `ComplexTextured` + `SkyboxWH` shaders. The arena is lit with four point lights, which dynamically turn off when it becomes day. Then the sun "comes out," which is modeled with a directional light. Another directional light supports the sun to simulate the sky lighting. Lastly, when the sudden death mode starts, a yellow flickering light turns on to warn the players that the game is about to get tougher.

Most of the code for the lighting was retrofitted from one of our members' 174a project code. The code is available on GitHub @cs174a-project. It had to be modified to work well with our code.

The skybox uses an approximation table derived from Hosek-Wilkie's sky model. The original code in 174a was transcribed from an applet found in Shadertoy by a user called pajunen @pajunen-skybox. For our project, it had to be rewritten from JavaScript to TypeScript. This shader comes with a GLSL version and a JS version. The latter allows the generation of colors based on the location of the sun, which can be used to give the directional lighting color as well as ambient light by sampling the sky. Finally, we wrote a new sampler for the horizon. This color was used to add a distance fog effect to the `ComplexTextured` shader.

As previously said in section #ref(<render-system>), `ComplexTextured` allows setting textures for color, highlights, and normals. However, the original code had a quality implementation for approximating bi-tangents to nudge the normals. At its core, it is simply a TBN matrix, but it was being approximated in the fragment shader. Instead, we removed this approximation code. Then, computed the tangents and bitangents in the object itself in the `arrays` property of tiny-graphics shapes. These are automatically passed to the GPU by tiny-graphics internals.

Finally, the last two important components were the `ParticleShape` class. It uses a fixed buffer of vertices that can be updated right before every draw call. We manually call `drawArrays` and bypass the tiny-graphics normal draw call. The purpose of this was to render orbit particles and sparks all in a single draw call. We utilized the `GL_LINES` and `GL_POINTS` modes, respectively, to render sparks and light orbs.

// #ref(<spark-sky-fig>) shows the sparks in action and the skybox in the background

#figure(
  image("images/spark-sky-showcase.png"),
  caption: [Sparks generation and the skybox in the background],
)<spark-sky-fig>

#figure(
  image("images/texture-details.png"),
  caption: [Texture Mapping],
)

#figure(
  image("images/light-orb-splats.png"),
  caption: [Light Orbs],
)

= Gameplay Systems
// TODO:

== Game User Interface

```ts
render_layout(div: HTMLDivElement, options?: ComponentLayoutOptions): void {
    super.render_layout(div, options);

    const canvas = this.canvas ?? document.getElementById("canvas")!;
    const canvasDiv = document.createElement("div");
    canvas.parentElement?.insertBefore(canvasDiv, canvas);
    canvasDiv.insertBefore(canvas, null);

    this.gui = new GameGUI(canvasDiv);
```
The tiny graphics scene is rendered with WebGL on `canvas`. In `render_layout`, a wrapper `canvasDiv` is inserted, and the `canvas` element is moved inside. Finally, the GUI is stored in the `GameGUI` class, which is attached to the `canvasDiv`. `GameGUI` is rendered over the `canvas` using absolute position. `GameGUI` stores many HTML DOM elements with CSS styling to create an easily formatted and pleasing user interface. Game logic updates the HUD using the methods in `GameGUI` for things like the timer, health bar, messages, and the game-over screen.

#figure(
  image("images/hud_demo_image.png"),
  caption: [Game HUD],
)

== Game State Logic
`gameMatch.ts` and `BumperCars` in `main.ts` (which is the "main scene") contain most of the game state logic. The `MatchManager` handles power-ups, health, score, the game-over sequence, triggering sudden-death, and winning/losing. `BumperCars` contains the instance of `MatchManager` as well as hooking the music registry for volume control, the background music, some vfx, fine-tuned control over the game-over sequence, spawning power-ups, and anything that isn't physics-based.

= Audio System
// TODO:

== Stereo Panning

Since we have two cars occupying the same space on the screen, we developed a system in the `AudioSystem` class that allows us to define a stereo panning value. In the `CarSound` class, we have a helper that computes the panning value based on the relative location of the car to the camera. The formula is a simple dot product of the camera-car vector and the side vector of the camera. The result is then clamped between -1 and 1 to set the panning coefficient.

== Dynamic Frequency

Engine sounds are not trivial to simulate because they have nuances that make them sound unique when in different states. Particularly, the pitch of the engine is a function of the RPM, which is related to wheel speed. The loudness of the engine is a function of how much torque it provides. Additionally, they do not sound the same depending on whether the car is idling and how much the throttle is depressed. Many variables affect the acoustics of an engine, so we decided to settle on a middle ground of having three engine sounds: idle, half throttle, and full throttle. We used Audio samples from the free program called Engine Simulator (Community Edition) [4]. It is an extremely complex and interesting program that simulates engines and provides realistic sounds with many options that can be adjusted.

To accommodate the more complex engine sounds, we created a class that orchestrates all of these different sounds. The pitch/volume update of the audio context happens right after the physics loop finishes, so we use the average wheel speed to set the playback rate (i.e, the pitch), and the tire thrust to set the volume. As well as some other functions that help blend the sounds to make a more natural-sounding engine.

== Collision Sounds

We have two types of collision sounds. A slow collision and a fast collision. These collision sounds are based on the impulse a car experiences when crashing into a wall or another car. In addition, the volume of the collision sound scales with the magnitude of the impulse. Collision sounds also have their nuances. In this case, we had to work around two hurdles in the way collisions are detected:
+ they are not a single event but a series of rapid successive contacts
+ the force is determined by the impulse, but we only cache forces once per physics frame, not per-drawing frame

To overcome the first hurdle, we implemented a cooldown timer that waits until a certain amount of time has passed to dispatch another collision sound. This is to stop an instant succession of collision sounds with a delay of around 300ms before another sound can be played.

For the second issue, in simpler terms, if an impulse is detected, it will always, aside from edge cases of an overwhelming force, play the slow collision sound as the impulse hasn't had time to accumulate for a fast collision. We solved this by having a flush timer of around 50ms. This timer was tuned to be long enough to accumulate the impulse to play the fast collision sound, but short enough not to be noticeably delayed.

= Software Engineering

From the bottom up, the project was structured to follow good SWE patterns, especially to allow mix and matching elements and work in a team of 3 more effectively, since the worst bottleneck in fast-paced projects such as this one is coordination.

One of the best decisions we made when starting the project was to type-declare all the base libraries of tiny-graphics. As a regular JS library, tiny-graphics is a hindrance in managing large projects because the lack of transparency in the inner mechanisms used makes it too easy to accumulate tech debt quickly. On top of that, writing the declaration files revealed a lot of the patterns that tiny-graphics uses, so we were able to exploit its features more leisurely.

The additional layer of Typescript also allows us to avoid very common foot guns in the bare JS counterpart. For example, multiplying matrices of incompatible sizes. Inadvertently leave a variable or member value uninitialized, and spend hours trying to hunt it down.

From here, we were able to build layer upon layer of components, taking advantage of the type system. For example, classes such as `MatchManager` and `CartArmature` use an event listener pattern that allows us to construct the classes in the main scene constructor and spawn event listeners where they can access the context they need for the callback's closure. This pattern was used to define the game sequence of events and also to let us know when the blade swings, which was used to enable sound.

Another useful pattern used is a top-down lexer and parser to replace the one available in tiny-graphics. The aforementioned had a bug in which it clobbered some of the triangles under some circumstances because that algorithm misinterpreted the number of vertices it had available to parse with face indices. Also, it silently failed in many ways. The type-safe parser we built allows us to guarantee the integrity of the file and stored parameters one layer at a time.

The results of that work are that we were able to dynamically load OBJ files, their MTL files, and even textures relative to them, with the ability to reuse them, too.

As previously mentioned in the audio system, we also integrated a mixer class called `AudioMixRegistry`, which was used to orchestrate the volume of the sound effects and music separately, as well as a master volume. This enabled easy tuning of ability SFX and the music to offer a more pleasant listening experience. This allows for safe control of the volume of the assets, which are bound to event listeners based on what happens in the game.

= Performance

Along the path to completion of the project, we decided to write the entire logic of the spring-mass system using immutable operations only. Like Donald Knuth once said, "premature optimization is the root of all evil". However, at the beginning of week 9, we started to notice some hiccups in performance when debugging the beam frame of the vehicles. The performance degradation happened when drawing a significant number of beams, but we quickly dropped that suspicion because approximately 100 draw calls should be nothing for a modern computer.

Eventually, more careful profiling showed that the culprit was garbage collection. The root of this was the immutable operations we had been using so far. A quick napkin calculation revealed that we were asking JS to construct and collect about a 1 million `Vector3` objects per second. As impressive as it is that a computer is able to do that, this was less than ideal. We put as a top priority to refactor the core parts of the mass-spring-damper system to instead use mutable operations. However, we used a smart approach to avoid breaking the entire system with shared references.

We fit the `SpringDamperSystem` class with a fixed-length array of `Vector3` caches that we could use during the forces computation. This allows the code to remain readable and fast. The following is a small excerpt using the cache system to perform the calculations of the slip angle grip model for the tires
```ts
if (field.traction && p.tags.has("tire")) {
  // cache aliases
  const forward = this.cache.tempVec[1];
  const forwardProj = this.cache.tempVec[2];
  const lateral = this.cache.tempVec[3];

  // slip angle friction

  // this is the tire forward (may not be planar to surface)
  setVector(forward, p.tireForward!);
  forward.normalize();

  // project forward onto normal (zero most of the time)
  projMut(normal, forward, forwardProj);
  forward.subtract_by(forwardProj);
  forward.normalize();

  // get lateral vector
  crossMut(normal, forward, lateral);
  lateral.normalize();
  // ... the rest of the code
}
```

Further profiling after we verified that the simulation ran similarly to the mutable code showed at least a 10 times increase in performance. Needless to say, the hiccups were gone.

= Challenges

== Numerical Instability

One of the challenges, especially in the early stages, was managing the numerical instabilities of the mass-spring-damper system. The first of this challenge was due to the high tensions in the springs needed to ensure the collisions between the clusters were "solid". While adjusting these values, the car tended to blow up and disappear. The root issue was extremely high spring forces in the 6 digits. After that, it spiraled out of control and eventually NaNs spread throughout the whole connected node cluster.

The core issue of this is just the accuracy of the integration, but Symplectic was the only one that proved itself to be the most resilient, so instead of trying to look for an alternative integration, we patched the issue by blocking updates in the integrator if the resulting new force becomes a NaN. At a more fine-grained level, this introduces energy losses during the collisions, but the dampers already dissipate energy, so the collisions did not look any different, while the random explosions went away entirely.

== Collision Accuracy

A particular issue that surfaced during this stage was also cars getting momentarily stuck to each other. The reason was the geometry of the derivative of the signed distance function used for the collision boundary of the car. It was originally defined as an extruded 2D capsule (see #ref(<capsule-diagram>)).

#figure(
  image("images/capsule-sdf.png"),
  caption: [Capsule SDF (3D view)],
)<capsule-diagram>

The issue with this design is that if the nodes penetrate deep enough, they reach the other side of the signed distance function, and instead of pushing away, they start to pull in. This becomes more evident in the following diagram of a heat map of the capsule SDF

#figure(
  image("images/capsule-sdf-heatmap.png"),
  caption: [Capsule SDF (slice view)],
)

The solution to this problem didn't come until much later, near the end of the project. Once the mass-spring-damper system had already been optimized, we were able to compute a fully oriented bounding box. The formula for that one requires an inverse matrix of the frame orientation. The formula is the following
```glsl
float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(
    max(q,0.0)) +
    min(max(q.x,max(q.y,q.z)),0.0
  );
}
```

That requires the box to be on the origin, so then
```glsl
// p is probe point
// c is center of frame
// T is transform of frame
sdBox(invert(T) * (p - c));
```

Now the entire frame is in the origin, so the same formula works. What is even better is that the vector field of the oriented bounding box SDF has a much smaller "sign" singularity. Another huge benefit is that when the car flips over, the collider does not become "degenerate", as is the case with the extruded capsule.

#bibliography("references.yaml", style: "ieee", full: true)
