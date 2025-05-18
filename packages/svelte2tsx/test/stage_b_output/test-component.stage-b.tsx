///<reference types="svelte" />
;
  const moduleVar = "Hello from Module Civet!"
  console.log(moduleVar)
  // Civet Line 3 in module script (original)
  const add = function(a, b) { return a + b } 
  export const c = add(10, 20) 
;;function $$render() {

  // Civet Line 1 in instance script (original)
  const instanceVar = "Hello from Instance Civet!"
  console.log(instanceVar) 
  // Civet Line 3 in instance script (original)
  const x = 1; const y = 2 
  const z = x + y
  console.log(z)
;
async () => {




 { svelteHTML.createElement("h1", {});  }
 { svelteHTML.createElement("p", {});instanceVar; }
 { svelteHTML.createElement("p", {});moduleVar; }
 { svelteHTML.createElement("p", {});c; }
};
return { props: {} as Record<string, never>, slots: {}, events: {} }}

export default class TestStageBComponent__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event($$render())) {
}