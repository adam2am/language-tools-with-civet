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

  // Conditional logic
  const x_mod = 10
  export const message_mod = (x_mod > 5?
    "Greater than 5 (module)" :
    "Not greater than 5 (module)")
  console.log(message_mod)

  // Loop
  export const doubled_mod = []
  for (let i1 = 1; i1 <= 3; ++i1) {const i = i1;
    doubled_mod.push(i * 2)
  }
  console.log(doubled_mod) // [2, 4, 6]
;;function $$render() {

  // Instance script with complex Civet
   let instanceVar: string = "Hello from Complex Instance Civet!"/*Ωignore_startΩ*/;instanceVar = __sveltets_2_any(instanceVar);/*Ωignore_endΩ*/
  console.log(instanceVar)

  // Multi-line arrow function (instance)
  const complexAddInst = function(a, b) {
    const c = a + b
    const d = c * 2
    return d
  }
  const calculatedInst = complexAddInst(2, 2) // Should be 8
  console.log(calculatedInst)

  // Conditional logic
  const x_inst = 10
  let ref;if (x_inst > 5) {
    ref = "Greater than 5 (instance)"
  } else {
    ref = "Not greater than 5 (instance)"
  };const message_inst =ref
  console.log(message_inst)

  // Loop
  const doubled_inst = []
  for (let i1 = 1; i1 <= 3; ++i1) {const i = i1;
    doubled_inst.push(i * 2)
  }
  console.log(doubled_inst) // [2, 4, 6]

  // Another destructuring example
  let { propA, propB = "defaultB" } = { propA: "ValueA" }
  console.log(propA, propB)
;
async () => {




 { svelteHTML.createElement("div", {});
 { svelteHTML.createElement("p", {});moduleVar; }
 { svelteHTML.createElement("p", {});calculated; }
   { svelteHTML.createElement("p", {});nestedKey; first; third; }
   { svelteHTML.createElement("p", {});message_mod; }
   { svelteHTML.createElement("p", {});doubled_mod.join(','); }

   { svelteHTML.createElement("p", {});instanceVar; }
   { svelteHTML.createElement("p", {});calculatedInst; }
   { svelteHTML.createElement("p", {});message_inst; }
   { svelteHTML.createElement("p", {});doubled_inst.join(','); }
   { svelteHTML.createElement("p", {});propA; propB; }
 }
};
return { props: {instanceVar: instanceVar} as {instanceVar?: string}, slots: {}, events: {} }}

export default class TestStageBComplexComponent__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event($$render())) {
}