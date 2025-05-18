///<reference types="svelte" />
;
  // Module script with complex Civet
  export const moduleVar = "Hello from Complex Module Civet!"
  console.log(moduleVar)

  // Multi-line arrow function
  export const complexAdd = function(a, b) {
    const c = a + b
    // Civet comment
    const d = c * 2
    return d
  }

  export const calculated = complexAdd(5, 3) // calculated should be 16

  // Object and array destructuring
  const { anObject: { nestedKey }, anArray: [first, ,third] } = { anObject: { nestedKey: "ModuleValue" }, anArray: [10, 20, 30] }
  console.log(nestedKey, first, third) // "ModuleValue", 10, 30
;;function $$render() {

  // Instance script with complex Civet
  const instanceVar = "Hello from Complex Instance Civet!"
  console.log(instanceVar)

  // Conditional logic
  const x = 10
  let ref;if (x > 5) {
    ref = "Greater than 5"
  }
  else {
    ref = "Not greater than 5"
  };const message =ref
  console.log(message)

  // Loop
  const doubled = []
  for (let i1 = 1; i1 <= 3; ++i1) {const i = i1;
    doubled.push(i * 2)
  }
  console.log(doubled) // [2, 4, 6]

  // Another destructuring example
  let { propA, propB = "defaultB" } = { propA: "ValueA" }
  console.log(propA, propB)
;
async () => {




 { svelteHTML.createElement("h1", {});   }
 { svelteHTML.createElement("p", {});instanceVar; }
 { svelteHTML.createElement("p", {});moduleVar; }
 { svelteHTML.createElement("p", {});calculated; }
 { svelteHTML.createElement("p", {}); nestedKey;  first;  third; }
 { svelteHTML.createElement("p", {}); message; }
 { svelteHTML.createElement("p", {}); doubled.join(', '); }
 { svelteHTML.createElement("p", {}); propA; propB; }
};
return { props: {} as Record<string, never>, slots: {}, events: {} }}

export default class TestStageBComplexComponent__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event($$render())) {
}