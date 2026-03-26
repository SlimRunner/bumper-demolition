import { BumperCars } from "@/main"; // your scene
import { defs } from "@tiny/common"; // if still needed

// If tiny-graphics relies on defs mutation, keep this:
Object.assign(defs, { BumperCars });

const element_to_replace = document.querySelector("#main-section")!;

if (!(element_to_replace instanceof HTMLDivElement)) {
  throw new Error("Failed to initialize tiny-graphics container");
}

const root = new BumperCars();

root.animated_children.push(
  // if you have extra scenes, add them here
);

root.render_layout(element_to_replace);
