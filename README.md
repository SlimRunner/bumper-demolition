# CS174C - Final Project

## Name: TBD

Members:
- Adrian Pu
- Andy Kasbarian
- Kyle Deveaux
- Mario Flores

A bumper-cars inspired game implemented using tiny-graphics with a typescript layer on top. The goal of the game is to damage your opponent to deplete their health to 0 first.

## Setup

First install the node packages
```sh
npm install
```

Then open a terminal to run nodemon for continuous building
```sh
npm run dev
```

Or if you just want to build once
```sh
npm run build
```

That will generate all the JS output in a directory called [my-code](./my-code/). Be aware that code in this folder should not be modified directly and is also not git-tracked.

Finally open a second terminal and execute the default provided script to run localhost
```sh
python server.py
# or ./host.*
```

> NOTE: building takes about 4 seconds because of the script to fix import references (adds the `.js`).

## Development

1. Make sure that you **import only using relative paths for all files and do not use extensions**.
   ```ts
   // example
   import { tiny } from "../tiny-graphic";
   import { math } from "../tiny-graphics-math";
   import { defs } from "../examples/common";
   import { myTSLib } from "./library/some-ts-file"
   // NOTE that tiny-graphics "encourages" to import `tiny` and `math`
   // from common but these are not changed at all, so it is pointless.
   // The declaration file was simplified and prevents this so just
   // import from their actual source
   ```
2. All the code should be contained in `src`. The output is perfectly mirrored in `my-code`.

The reason for the import requirement is to enable jest testing (in case we might need it), but still allow the references to be trivially fixable since tiny graphics crashes if you do not import using `.js`.
