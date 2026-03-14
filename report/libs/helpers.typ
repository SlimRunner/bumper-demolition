#let listify(ranges, sep, callback, trailWord: none) = {
  let content = ()
  for item in ranges {
    if type(item) == array and item.len() == 2 {
      let (a, b) = item
      if type(a) == int and type(b) == int {
        for i in range(a, b + 1) {
          content.push($#callback(i)$)
        }
      } else {
        assert(false, "invalid range item")
      }
    } else if type(item) == int {
      content.push($#callback(item)$)
    } else {
      content.push($#callback(item)$)
    }
  }

  if trailWord != none {
    content.at(-1) = [#trailWord] + content.at(-1)
  }

  return content.reduce((acc, x) => acc + sep + x)
}

#let upbold(x) = $upright(bold(#x))$