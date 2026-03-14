#import "libs/helpers.typ": listify, upbold

#set page(
  paper: "a4",
  columns: 2,
)
#set heading(numbering: "1.")

#let param = (
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
  ..param,
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
    #listify(param.author, [#h(15mm)], c => text(weight: "bold")[#c])
    #v(0.5cm)
  ],
)

#heading(numbering: none)[Abstract]

// TODO:

= Introduction

Bumper Demolition is a 2-player game bounded to a circular derby-like arena. The goal of the game is to be a fun fast-paced match with a friend. The game starts with both players looking away from each other away from the arena's center. Each has a power-up box right in front of them.

Which leads to the next part: power-ups. There are 2 collectible, time-limited, power ups and one that is permanently equipped into the car. These are

+ Juggernaut: collecting a yellow box doubles the car's mass and its thrust for a few seconds. Takes less inertia during collisions and thus less damage
+ Particle Barrier: collecting a purple box provides a time-limited set of particle orbits. These orbs cause damage to the enemy upon contact and immediately disappear.
+ Roof Mounted Blade: this powerful blade is user controlled and swings forward for a total of 3. If the other player makes contact with the blade while it is deployed it causes great continuous damage.

The power ups are randomized but the first 2 are always Particle Barriers. The final goal of the game is to deplete the enemies health to 0 before the time limit hits. In the last minute a sudden death stage begins with a shrinking column field. Going outside of this column continually depletes the player's health. The health depletion intensifies the smaller the column is.

= Related Work

Our simulation is purely based using what we learned in the assignments of this course. At some point BeamNG Drive was brought up as inspiration to use a rigid frame on a mass-spring-damper system to approximate rigid collisions.

= System Architecture

We designed our game to be modular. The following describe the major components that put everything together.

== Rendering System

Of course we used tiny-graphics, but we made ourselves major graphical components. Two of the most important ones are the skybox and complex texture shader.

The skybox was retrofit from one of our 174a project. The skybox uses an approximation table derived from the Hosek-Wilkie's sky model. The original code in 174a was written using an applet found in shadertoy @pajunen.

Additionally, the entire shader code was rewritten in JavaScript, and subsequently into TypeScript for our project. This rewrite allows to sample the sky model for retrieve ambient light and sun color from the model. This system allows dynamic lighting depending on the latitude and longitude of the sun on the sky.

The second major component is the complex texture shader. This also came from the same 174a project. It allows to load three separate textures for diffuse color, specular highlights, and bump mapping. This shader had a bad quality implementation for approximating bitangents to use a TBN matrix to perform the normal nudges. To fix this issue we decided to compute the tangents and bitangents in TypeScript taking advantage of tiny-graphics automatic managing of mesh properties during draw calls. We simply added tangents and bitangents to the `array` member of whichever shapes we paired with this shader.

All entire code for the project we used as reference is available on github @char.

== Physics Simulation

The physics simulation is where we put the most effort. The resulting system was a little bit of a strike of luck. Originally, our project intended to use rigid body collision, but a few days of iteration proved that it was going to be difficult to implement something brand new that we never used in practical terms during this course. Thankfully, a visit to the TA gave us the advice we needed to move forward. He suggested that instead of trying to implement rigid collisions we could re-use our code from the mass-spring-damper coupled with a rigid frame and some way to detect collisions.

This last part was problematic because we did not see how to do that in this course, at least not explicitly, but we had all the tools to sort out this obstacle too. As it turns out a penalty constraint usually in the form of a ground plane only needs 2 things to work properly: signed penetration distance and a normal. It was clear that we could use these so called "signed distance fields" to get arbitrary collider shapes. These functions are usually in the form of primitives. For example, a plane SDF is simply $upbold(v) dot upbold(n) + h$ for some vector $upbold(v)$ the plane normal and the height. Similar story for circles, prisms, rounded rectangles, boxes, you name it.

However, not all of them are straightforward to derive, but luckily for us the mathematician and Computer Graphics engineer Inigo Quilez (who incidentally is also the author of shadertoy) shares a lot of these in his website @quilez. We took these SDF primitives written in GLSL and translated them into TypeScript. The only other burden we had to sort out was figuring out how to dynamically update the collider for the cars since these obviously cannot be static. They have to move in sync with the car which means high frequency math computations.

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
  table.header([*Part*], [*Mesh*]),
  [arm 1    ], [cylinder],
  [arm 2    ], [cylinder],
  [chassis  ], [cube    ],
  [saw blade], [disc    ],
  [wheels   ], [cylinder],
))

And these are the *base* dimensions expected by `CartArmature`
- cylinder: $x: [-1, 1], y: [-1, 1], z: [-0.5, 0.5]$
- disc: $x: [-1, 1], y: [-1, 1], z: [-u, u]$
- cube: $x: [-1, 1], y: [-1, 1], z: [-1, 1]$

= Environment
// TODO:

= Particle Effects
// TODO:

= Shading & Lighting
// TODO:

= Gameplay Systems
// TODO:

= Audio System
// TODO:

= Software Engineering

From the bottom up the project was structure to follow good SWE patterns especially to allow mix and matching elements and work in a team of 3 more effectively since the worst bottleneck in fast paced projects such as this one is coordination.

One of the best decisions we made starting the project was to type declare all the base libraries of tiny-graphics. As a regular JS library tiny-graphics is a hindrance in managing large projects because the lack of transparency in the inner mechanisms used makes it too easy to accumulate tech debt quickly. On top of that, writing the declaration files revealed a lot of the patterns that tiny-graphics use, so we were able to exploit its features more leisurely.

The additional layer of TypeScript also allows to avoid very common foot guns in the bare JS counterpart. For example, multiplying matrices of incompatible sizes. Inadvertently leave a variable or member value uninitialized, and spend hours trying to hunt it down.

From here we were able to build layer upon layer of components taking advantage of the type system. For example, class such as `MatchManager` and `CartArmature` use an event listener pattern that allows to construct the classes in the main scene constructor and spawn event listeners where they are able to access the context they need for the callback's closure. This pattern was used to define the game sequence of events and also to let know main when the blade swings which was used to enable sound.

Another useful pattern used is a top down lexer and parser to replace the one available in tiny-graphics. The aforementioned had a bug in which it clobbered some of the triangles under some circumstances because that algorithm misinterpreted the number of vertices it had available to parse with face indices. Also, it silently failed in many ways. The type safe parser we build allows to guarantee the integrity of the file and stored parameters one layer at time.

The results of that work is that we were able to dynamically load OBJ files their MTL and even textures relative to them, with the ability to reuse them too as mentioned earlier.

= Performance

Along the path to completion of the project we decided to write the entire logic of the spring-mass system using immutable operations only. Like Donald Knuth once said, "premature optimization is the root of all evil". However, at the beginning of week 9 we started to notice some hiccups in performance when debugging the beam frame of the vehicles. The performance degradation happened when drawing a significant number of beams, but we quickly dropped that suspicion because approximately 100 draw calls should be nothing for a modern computer.

Eventually, more carful profiling showed that the culprit was garbage collection. The root of this was the immutable operations we had been using so far. A quick napkin calculation revealed that we were asking JS to construct and collect about a 1 million `Vector3` objects per second. As impressive as it is that a computer is able to do that, this was less than ideal. We put as top priority to refactor the core parts of the mass-spring-damper system to instead use mutable operations. However, we used a smart approach to avoid breaking the entire system with shared references.

We fit the `SpringDamperSystem` class with a fixed length array of `Vector3` caches that we could using during the forces computation. This allowed the code to remain readable and fast. The following is a small excerpt using the caches to keep the calculations of the slip angle grip calculations
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

Further profiling after we verified that the simulation ran similarly to the mutable code showed at least a 10x increase in performance. Needless to say that the hiccups were gone.

= Challenges

= Results

= References

#bibliography("references.yaml", style: "ieee")
