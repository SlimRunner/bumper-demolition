#import "libs/helpers.typ": listify, upbold

#set page(
  paper: "a4",
  columns: 2,
  numbering: "1"
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
- 2 rear tires each with 1 rotational degree of freedom
- 2 front tires each with 2 rotational degrees of freedom
- 2 jointed arms connected each with a single rotational degree of freedom
- 1 saw blade at the end of the jointed arm with 1 degree of freedom

We did not use inverse kinematics. It was all pure animation driven by physics driven mass-spring-damper frames.

== Mass-Spring-Damper System

The physical world lived all entirely inside a single mass-spring-damper system simulation. In order to create the vehicles we partitioned the buffers of particles and used a tagging system to extract information of specific "clusters" of particles. The buffers are structured as follows:

#align(center, table(
  columns: 3,
  table.header(
    [*Cluster*], [*Type*], [*Count*]
  ),
  [Car A], [spring-damper], [26 + 138],
  [Car B], [spring-damper], [26 + 138],
  [Orbits A], [kinematic], [25],
  [Orbits B], [kinematic], [25],
  [Power Ups], [kinematic], [2],
  [Saw Blades], [kinematic], [2],
  [Sparks], [free-dynamic], [100],
))

The frame was designed in Desmos and the particle positions and springs pairs were both hardcoded in the particle manager class from the original design. The spring lengths were simply computed with the Euclidean distance between the particle-pairs.

#figure(
  image("images/car-frame.png"),
  caption: [#link("https://www.desmos.com/3d/7dh0kev2zd")[Car Frame]]
)

== Collision Detection and Response

In order to perform collision detection we used Signed Distance Functions (SDF for short). They are explained more in detail below, but in summary these functions allow to construct non-trivial penetration penalty surfaces that we can apply a spring and damper constraints to. The ones we used in our project are the following:

#align(center, table(
  columns: 2,
  table.header(
    [*Type*], [*Purpose*]
  ),
  [plane], [ground],
  [extruded capsule], [arena boundary],
  [oriented box], [vehicles],
))

Each of these also define a few extra optional parameters such as tangential friction, traction model (for the tires), and restitution force (for rigid stability). Since these are not easy to visualize during constructions we also used Desmos to design these. The following figure shows a snapshot of the hull around the frame

#figure(
  image("images/frame-sdf-hull.png"),
  caption: [#link("https://www.desmos.com/3d/dak3107drk")[Frame SDF Hull]]
)

== Particle System

The particle system is baked into the mass-spring-damper system. The only difference is that these particles have no spring attachments and/or ignore physics calculations.

For the orbit particles we created a slightly randomized orbit as a parametric curve for every orbit particle. The formula is the following:

$
  vec(x(t), y(t), z(t)) = vec(r dot cos(omega t + phi), r dot sin(omega t + phi), h)
$

The radius $r$ is a constant plus some random nudge. The rest $omega$, $phi$, and $h$ are just random variables in the appropriate ranges.

For the sparks we made proper physical particles because otherwise they would not look good. These are slightly different from the normal masses in a spring-damper system in that we can dynamically mark them as "disabled" such that they become essentially kinematic particles. The purpose is to dispatch them on command. They inherit the location and velocity of the saw blade particles.

In order to achieve the natural "spread" of sparks coming out of a saw blade we used the Gram-Schmidt process (nudge in tangent space), and to get the direction of launch we used the normalized forward and up vectors of the respective frame. For example let $upbold(v)_"fwd"$ and $upbold(v)_"up"$ be the forward and up normalized vectors. Then for two random scalars $r_1$ and $r_2$ and an arbitrary coefficient $alpha >= 0$

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

  We simply add this vector to the initial velocity, override the particles location and velocity with their new ones, and re-enable the particle. Finally, to dispatch the limited number of particles available we use a ring buffer (or circular buffer) technique to dynamically recycle particles based on cadence and lifetime.

  Here is a link to a visualization of this in action:
  - #link("https://www.desmos.com/3d/yqwzzdaxa1")
]

= System Architecture

We designed our game to be modular. The following describe the major components that put everything together.

== Rendering System <render-system>

We used tiny-graphics, but we made several changes to improve upon the limited systems it provided. Two of the most important ones were the OBJ + MTL loader and the custom shaders we built.

Our OBJ parser supports the following flags
#align(center, table(
  columns: 2,
  table.header(
    [*Flag*], [*Description*]
  ),
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
  table.header(
    [*Flag*], [*Description*]
  ),
  [newmtl],[declare material],
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

The shaders are explained in more detailed in section #ref(<shade-light>) but in summary we made following
- `ComplexTextured`: manages three textures for diffuse, specular highlights, and normal mapping. If either of this is missing it defaults to a solid color for them (or scalar in the case of specular highlights).
- `SkyboxWH`: uses spherical coordinates and lookup table to render a realistic skybox
- `SolidColor`: a very simple shader that ignores lighting. It is used to simulate emissive objects
- `SplatShader`: creates light orbs at the positions of each vertex
- `UVShader`: debugging shader to visually inspect that model space normals are correct

== Physics Simulation

The physics simulation is where we put the most effort. The resulting system was a little bit of a strike of luck. Originally, our project intended to use rigid body collision, but a few days of iteration proved that it was going to be difficult to implement something brand new that we never used in practical terms during this course. Thankfully, a visit to the TA gave us the advice we needed to move forward. He suggested that instead of trying to implement rigid collisions we could re-use our code from the mass-spring-damper coupled with a rigid frame and some way to detect collisions.

This last part was problematic because we did not see how to do that in this course, at least not explicitly, but we had all the tools to sort out this obstacle too. As it turns out a penalty constraint usually in the form of a ground plane only needs 2 things to work properly: signed penetration distance and a normal. It was clear that we could use these so called "signed distance fields" to get arbitrary collider shapes. These functions are usually in the form of primitives. For example, a plane SDF is simply $upbold(v) dot upbold(n) + h$ for some vector $upbold(v)$ the plane normal and the height. Similar story for circles, prisms, rounded rectangles, boxes, you name it.

However, not all of them are straightforward to derive, but luckily for us the mathematician and Computer Graphics engineer Inigo Quilez (who incidentally is also the author of shadertoy) shares a lot of these in his website @quilez-sdf. We took these SDF primitives written in GLSL and translated them into TypeScript. The only other burden we had to sort out was figuring out how to dynamically update the collider for the cars since these obviously cannot be static. They have to move in sync with the car which means high frequency math computations.

For this we created a shared interface for all the SDFs with the following signature

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

We called this a `contact` field. With this pattern we can simply declare the SDF as a parameter in the constructor as a closure which have access to the frame. When it is called from within the mass-spring-damper simulator it can update its shape on demand to enable car-car collisions.

== Vehicle Model

The vehicle was made reusing the code we have made for assignment 2. We put together the strengths of our projects and made a very flexible framework to manage kinematic chains. Then we made the system more powerful by wrapping the entire construction of a vehicle under one class that accepts high level parameters like car width, height, tire size, and so on. Also we pass the meshes we want linked with the arcs and joints, and the rest is computed automatically inside the class.

To make this level of flexibility possible we had to put some constraints. Namely, we defined what the "standard" sizes of the input shapes must be in order for the sizes to reflect in the rendered model. We made the following spec

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
  "cylinder" &-> x: [-1, 1]&,& y: [-1, 1]&,& z: [-1/2, 1/2] \
  "disc" & -> x: [-1, 1]&,& y: [-1, 1]&,& z: [-t, s] \
  "cube" & -> x: [-1, 1]&,& y: [-1, 1]&,& z: [-1, 1] \
$

= Shading & Lighting <shade-light>
// TODO:

Our base class component defines the global number of lights that is going to be used among all the shaders in the project. We used a combination of tiny-graphics' native `Phong_Shader` and our `ComplexTextured` + `SkyboxWH` shaders. The arena is lit with four point lights which dynamically turn off when it becomes day and the sun "comes out" which is modeled with a directional light. Another directional light supports the sun to simulate the sky lighting. Lastly, when the sudden death mode starts a yellow flickering light turns on to warn the players that the game is about to get tougher.

Most of the code for the lighting was retrofit from one of our members 174a code. The code is available in on GitHub @cs174a-project. It had to be modified in order to work well with our code.

The skybox uses an approximation table derived from the Hosek-Wilkie's sky model. The original code in 174a was transcribed from an applet found in shadertoy by a user called pajunen @pajunen-skybox. For our project it had to be re-written from JavaScript to Typescript. This shader comes with a GLSL version and JS version. The latter allows to generate colors based on the location of the sun which can be used to give the directional lighting color as well as ambient light by sampling the sky. Finally, we wrote a new sampler for the horizon. This color was used to add a distance fog effect to the `ComplexTextured` shader.

As previously said in section #ref(<render-system>) `ComplexTextured` allows setting textures for color, highlights, and normals. However, the original code had quality implementation for approximating bi-tangents to nudge the normals. At its core it is simply a TBN matrix, but it was being approximated in the fragment shader. Instead we removed this approximation code and computed the tangents and bitangents in the object itself in the `arrays` property of tiny-graphics shapes. These are automatically passed to the GPU by tiny-graphics internals.

Finally, the last two important components were the `ParticleShape` class. It uses a fixed buffer of vertices that can be updated right before every draw call. We manually call `drawArrays` and bypass tiny-graphics normal draw call. The purpose of this was to render orbit particles and sparks all in a single draw call. We utilized the `GL_LINES` and `GL_POINTS` modes respectively to render sparks and light orbs.

// #ref(<spark-sky-fig>) shows the sparks in action and the skybox in the background

#figure(  
  image("images/spark-sky-showcase.png"),
  caption: [Sparks generation and the skybox in the background]
)<spark-sky-fig>

#figure(
  image("images/texture-details.png"),
  caption: [Texture Mapping]
)

#figure(
  image("images/light-orb-splats.png"),
  caption: [Light Orbs]
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

#image("images/hud_demo_image.png")

== Game State Logic
`gameMatch.ts` and `BumperCars` in `main.ts` contains most of the game state logic. The `MatchManager` handles power-ups, health, score, the game-over sequence, triggering sudden-death, and winning/losing. 

= Audio System
// TODO:

== Stereo Panning

Since we have two cars occupying the same space in the screen, we developed a system in the `AudioSystem` class that allows to define a stereo panning value. In the `CarSound` class we have a helper that computes the panning value based on the relative location of the car to the camera. The formula is a simple dot product of the camera-car vector and the side vector of the camera. The result is then clamped between -1 and 1 to set the panning coefficient.

== Dynamic Frequency

Engine sounds are not very trivial to simulate because they have a lot of nuances that make them sound they way they do. Particularly, the pitch of the engine is a function of the RPM which is related to wheel speed. The loudness of the engine is a function of how much torque it is providing. Additionally, they do not sound the same depending on whether the car is idling and how much the throttle is depressed.

To accommodate for all of this dynamics we created a class that orchestrates all of these values using three different engine sound samples: idle, half throttle, and full throttle. The pitch/volume update of the audio context happens right after the physics loop finished, so we use the average wheel speed to set the playback rate (i.e. the pitch), and the tire thrust to set the volume.

== Collision Sounds

Collision sounds also have their nuances. In this case we had to work around two hurdles of the way collisions are detected:
+ they are not a single event but a series of rapid successive contacts
+ the force is determined by the impulse, but we only cache forces once per physics frame not per-drawing frame

To overcome the first hurdle we implemented a cooldown timer that waits until certain amount of time has passed to dispatch another collision sound.

For the second issue we implemented a two step process to dispatch the sound. Inside the collision detection callback that occurs every physics frame we accumulated the impulse forces inside the `CarSound` class and we "flush" the sound in one single event once per drawing frame.

= Software Engineering

From the bottom up the project was structure to follow good SWE patterns especially to allow mix and matching elements and work in a team of 3 more effectively since the worst bottleneck in fast paced projects such as this one is coordination.

One of the best decisions we made starting the project was to type declare all the base libraries of tiny-graphics. As a regular JS library tiny-graphics is a hindrance in managing large projects because the lack of transparency in the inner mechanisms used makes it too easy to accumulate tech debt quickly. On top of that, writing the declaration files revealed a lot of the patterns that tiny-graphics use, so we were able to exploit its features more leisurely.

The additional layer of Typescript also allows to avoid very common foot guns in the bare JS counterpart. For example, multiplying matrices of incompatible sizes. Inadvertently leave a variable or member value uninitialized, and spend hours trying to hunt it down.

From here we were able to build layer upon layer of components taking advantage of the type system. For example, class such as `MatchManager` and `CartArmature` use an event listener pattern that allows to construct the classes in the main scene constructor and spawn event listeners where they are able to access the context they need for the callback's closure. This pattern was used to define the game sequence of events and also to let know main when the blade swings which was used to enable sound.

Another useful pattern used is a top down lexer and parser to replace the one available in tiny-graphics. The aforementioned had a bug in which it clobbered some of the triangles under some circumstances because that algorithm misinterpreted the number of vertices it had available to parse with face indices. Also, it silently failed in many ways. The type safe parser we build allows to guarantee the integrity of the file and stored parameters one layer at time.

The results of that work is that we were able to dynamically load OBJ files their MTL and even textures relative to them, with the ability to reuse them too as mentioned earlier.

As previously mentioned in the audio system we also integrated a mixer class called `AudioMixRegistry` which was used to orchestrate the volume of the sound effects and music separately as well as a master volume. This allows to safely control the volume of the assets which are bound to event listeners based on what happens of the game.

= Performance

Along the path to completion of the project we decided to write the entire logic of the spring-mass system using immutable operations only. Like Donald Knuth once said, "premature optimization is the root of all evil". However, at the beginning of week 9 we started to notice some hiccups in performance when debugging the beam frame of the vehicles. The performance degradation happened when drawing a significant number of beams, but we quickly dropped that suspicion because approximately 100 draw calls should be nothing for a modern computer.

Eventually, more carful profiling showed that the culprit was garbage collection. The root of this was the immutable operations we had been using so far. A quick napkin calculation revealed that we were asking JS to construct and collect about a 1 million `Vector3` objects per second. As impressive as it is that a computer is able to do that, this was less than ideal. We put as top priority to refactor the core parts of the mass-spring-damper system to instead use mutable operations. However, we used a smart approach to avoid breaking the entire system with shared references.

We fit the `SpringDamperSystem` class with a fixed length array of `Vector3` caches that we could use during the forces computation. This allows the code to remain readable and fast. The following is a small excerpt using the cache system to perform the calculations of the slip angle grip model for the tires
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

Further profiling after we verified that the simulation ran similarly to the mutable code showed at least a 10 times increase in performance. Needless to say that the hiccups were gone.

= Challenges

== Numerical Instability

One of the challenges, especially in the early stages, was managing the numerical instabilities of the mass-spring-damper system. The first of this challenge was due to the high tensions in the springs needed to ensure the collisions between the clusters was "solid". While adjusting this values, the care tended to blow up and disappear. The root issue was extremely high spring forces in the 6 digits. After that it spiraled out of control and eventually NaNs spread through out the whole connected node cluster.

The core issue of this is just the accuracy of the integration, but Symplectic was the only that proved itself to be the most resilient, so instead of trying to look for an alternative integration we patched the issue by blocking updates in the integrator if the resulting new force becomes a NaN. At a more fine grained level this introduces energy loses during the collisions, but the dampers already dissipate energy, so the collisions did not look any different while the random explosions went away entirely.

== Collision Accuracy

A particular issue that surfaced during this stage was also cars getting momentarily stuck to each other. The reason was the geometry of the derivative of the signed distance function used for the collision boundary of the car. It was originally defined as a extruded 2D capsule (see #ref(<capsule-diagram>)).

#figure(
  image("images/capsule-sdf.png")
)<capsule-diagram>

The issue with this design is that if the nodes penetrate deep enough they reach the other side of the signed distance function and instead of pushing away, they start to pull in. This becomes more evident in the following diagram of a heatmap of the capsule SDF

#figure(
  image("images/capsule-sdf-heatmap.png")
)

The solution to this problem came until much later near the end of the project. Once the mass-spring-damper system had already been optimized we were able to compute a full oriented bounding box. The formula for that one requires an inverse matrix of the frame orientation. The formula is the following
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

That requires the box to be on the origin so then
```glsl
// p is probe point
// c is center of frame
// T is transform of frame
sdBox(invert(T) * (p - c));
```

Now the entire frame is in the origin so the same formula works. What is even better is that the vector field of the oriented bounding box SDF has a much smaller "sign" singularity. Another huge benefit is that when the car flips over the collider does not become "degenerate", as it is the case with the extruded capsule.

#bibliography("references.yaml", style: "ieee")
