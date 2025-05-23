import civet from '@danielx/civet';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { fileURLToPath } from 'url';
import { SourceMapConsumer } from 'source-map';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, 'micro_test_outputs');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function runCivetCompilationTest(testName, civetCode, civetCompileOpts = {}) {
    const logFilePath = path.join(outputDir, `${testName.replace(/\s+/g, '_')}_output.log`);
    let logOutput = `Running Civet Compilation Test: ${testName}\n`;
    logOutput += "============================================================\n";
    console.log(`\nRunning Civet Compilation Test: ${testName}`);
    console.log("============================================================");

    try {
        logOutput += "Input Civet Code:\n";
        logOutput += "------------------------------------------------------------\n";
        logOutput += civetCode + "\n";
        logOutput += "------------------------------------------------------------\n\n";

        console.log("Input Civet Code:");
        console.log("------------------------------------------------------------");
        console.log(civetCode);
        console.log("------------------------------------------------------------");

        const compileOptions = {
            sync: true,
            sourceMap: true,
            js: false, // Default to TS output
            filename: `${testName}.civet`,
            ...civetCompileOpts // Spread any passed options, allowing 'js: true' to override
        };

        const result = civet.compile(civetCode, compileOptions);

        logOutput += `Output ${compileOptions.js ? 'JavaScript' : 'TypeScript'} Code:\n`;
        logOutput += "------------------------------------------------------------\n";
        logOutput += result.code + "\n";
        logOutput += "------------------------------------------------------------\n\n";

        console.log(`\nOutput ${compileOptions.js ? 'JavaScript' : 'TypeScript'} Code:`);
        console.log("------------------------------------------------------------");
        console.log(result.code);
        console.log("------------------------------------------------------------");

        if (result.sourceMap) {
            const civetMapJson = result.sourceMap.json();
            // Patch sources[0] like we do in svelte2tsx
            if (civetMapJson && civetMapJson.sources && (civetMapJson.sources[0] === null || civetMapJson.sources[0] === undefined)) {
                civetMapJson.sources[0] = `${testName}.civet`;
                 logOutput += "Patched civetMapJson.sources[0] to: " + civetMapJson.sources[0] + "\n";
                console.log("\nPatched civetMapJson.sources[0] to: " + civetMapJson.sources[0]);
            }
            if (civetMapJson && civetMapJson.sourcesContent && civetMapJson.sourcesContent.length === 1 && !civetMapJson.sourcesContent[0]){
                civetMapJson.sourcesContent[0] = civetCode;
                 logOutput += "Patched civetMapJson.sourcesContent[0] with input Civet code.\n";
                console.log("Patched civetMapJson.sourcesContent[0] with input Civet code.");
            }


            logOutput += "Generated Civet V3 SourceMap JSON:\n";
            logOutput += "------------------------------------------------------------\n";
            logOutput += JSON.stringify(civetMapJson, null, 2) + "\n";
            logOutput += "------------------------------------------------------------\n";

            console.log("\nGenerated Civet V3 SourceMap JSON:");
            console.log("------------------------------------------------------------");
            console.log(JSON.stringify(civetMapJson, null, 2));
            console.log("------------------------------------------------------------");

            // Validate Sourcemap
            logOutput += "\nValidating Sourcemap with 'source-map' package:\n";
            logOutput += "------------------------------------------------------------\n";
            console.log("\nValidating Sourcemap with 'source-map' package:");
            console.log("------------------------------------------------------------");
            try {
                await SourceMapConsumer.with(civetMapJson, null, consumer => {
                    let errorsFound = 0;
                    let mappingsChecked = 0;

                    consumer.eachMapping(m => {
                        mappingsChecked++;
                        // m.generatedLine, m.generatedColumn (1-based, 0-based)
                        // m.originalLine, m.originalColumn (1-based, 0-based)
                        // m.source (path to original source file)
                        // m.name (original identifier, if any)

                        let isValid = true;
                        let errorMsg = '';

                        if (m.originalLine === null || m.originalColumn === null) {
                            // This can happen for mappings that only specify generated position
                            // but for Civet -> TS/JS, we expect most to have original positions.
                            // Depending on strictness, this could be an error.
                            // For now, let's consider it an error if a source is expected.
                            if (m.source !== null) {
                                isValid = false;
                                errorMsg = `Mapping to null original position (L${m.originalLine}C${m.originalColumn}) but source is not null (${m.source}).`;
                            }
                        } else {
                            if (m.originalLine < 1) {
                                isValid = false;
                                errorMsg += `Original line ${m.originalLine} is less than 1. `;
                            }
                            if (m.originalColumn < 0) {
                                isValid = false;
                                errorMsg += `Original column ${m.originalColumn} is less than 0. `;
                            }
                            if (m.source === null) {
                                isValid = false;
                                errorMsg += `Original source is null. `;
                            } else {
                                // Check if source is in sources array
                                if (!civetMapJson.sources.includes(m.source)) {
                                    isValid = false;
                                    errorMsg += `Source '${m.source}' not found in sourcemap sources array. `;
                                }
                                // Check if original position is within sourcesContent (if available)
                                const sourceContent = consumer.sourceContentFor(m.source, true);
                                if (sourceContent) {
                                    const lines = sourceContent.split('\n');
                                    if (m.originalLine > lines.length) {
                                        isValid = false;
                                        errorMsg += `Original line ${m.originalLine} exceeds source content lines (${lines.length}). `;
                                    } else if (m.originalLine > 0 && lines[m.originalLine -1] && m.originalColumn > lines[m.originalLine - 1].length) {
                                        // Be careful with CRLF vs LF, length might be slightly off for last char
                                        // This check is a bit lenient for EOL.
                                        if (m.originalColumn > lines[m.originalLine - 1].length +1) { // +1 to allow for EOL
                                            isValid = false;
                                            errorMsg += `Original column ${m.originalColumn} exceeds line length (${lines[m.originalLine - 1].length}) in source content for line ${m.originalLine}. `;
                                        }
                                    }
                                }
                            }
                        }


                        if (!isValid) {
                            errorsFound++;
                            const fullError = `Invalid mapping: Gen L${m.generatedLine}C${m.generatedColumn} -> Orig L${m.originalLine}C${m.originalColumn} (Source: ${m.source || 'null'}) - ${errorMsg}`;
                            logOutput += fullError + "\n";
                            console.log(fullError);
                        }
                    });
                    const summaryMsg = `Validation Complete: ${mappingsChecked} mappings checked. ${errorsFound} errors found.`;
                    logOutput += summaryMsg + "\n";
                    console.log(summaryMsg);
                });
            } catch (validationError) {
                const errorMsg = `Error during sourcemap validation: ${validationError.message}\n${validationError.stack}`;
                logOutput += errorMsg + "\n";
                console.error(errorMsg);
            }
            logOutput += "------------------------------------------------------------\n";
            console.log("------------------------------------------------------------");

        } else {
            logOutput += "No sourcemap generated by Civet.\n";
            console.log("\nNo sourcemap generated by Civet.");
        }

    } catch (e) {
        logOutput += `Error during Civet compilation for ${testName}: ${e.message}\n${e.stack}\n`;
        console.error(`Error during Civet compilation for ${testName}:`, e);
    }
    logOutput += "============================================================\n\n";
    console.log("============================================================\n");
    fs.appendFileSync(logFilePath, logOutput);
    console.log(`Test output saved to: ${logFilePath}`);
}

// --- Define and Run Tests ---

// Wrap test runs in an async function to use await for SourceMapConsumer
async function runAllTests() {
    // Test 1: Simple Variable Assignment
    const test1_SimpleVar = `
instanceVar := "Hello"
anotherVar := 123
`;
    await runCivetCompilationTest("Test1_SimpleVarAssignment", test1_SimpleVar);

    // Test 2: Console.log
    const test2_ConsoleLog = `
myVar := "Log me"
console.log myVar
console.log "Static string"
`;
    await runCivetCompilationTest("Test2_ConsoleLog", test2_ConsoleLog);

    // Test 3: Basic Conditional (If/Else)
    const test3_IfElse = `
x := 10
message := if x > 5
  "Greater"
else
  "Smaller or Equal"
y := if x == 10 then "IsTen" else "NotTen"
`;
    await runCivetCompilationTest("Test3_IfElse", test3_IfElse);

    // Test 4: Basic Loop (for...of)
    const test4_LoopForOf = `
items := [1, 2, 3]
doubled := []
for item of items
  doubled.push item * 2
`;
    await runCivetCompilationTest("Test4_LoopForOf", test4_LoopForOf);

    // Test 5: Object Destructuring with Default Assignment (.=)
    const test5_Destructuring = `
config := { a: 1 }
{ a, b = "default" } .= config
`;
    await runCivetCompilationTest("Test5_Destructuring", test5_Destructuring);

    // Test 6: Multi-line arrow function (from module script)
    const test6_MultiLineArrow = `
complexAdd := (a, b) ->
  c := a + b
  // Civet comment
  d := c * 2
  return d
`;
    await runCivetCompilationTest("Test6_MultiLineArrow", test6_MultiLineArrow);

    // Test 7: Combination - Loop with Conditional
    const test7_LoopWithIf = `
data := [1, 6, 3, 8]
processed := []
for val of data
  if val > 5
    processed.push "big"
  else
    processed.push "small"
`;
    await runCivetCompilationTest("Test7_LoopWithIf", test7_LoopWithIf);


    // Test 8: The problematic instance script section from stage_b_chaining_complex_test.mjs
    const test8_ComplexInstanceScriptContent = `
  // Instance script with complex Civet
  instanceVar := "Hello from Complex Instance Civet!"
  console.log instanceVar

  // Conditional logic
  x := 10
  message := if x > 5
    "Greater than 5"
  else
    "Not greater than 5"
  console.log message

  // Loop
  doubled := []
  for i of [1..3]
    doubled.push i * 2
  console.log doubled // [2, 4, 6]

  // Another destructuring example
  { propA, propB = "defaultB" } .= { propA: "ValueA" }
  console.log propA, propB
`;
    await runCivetCompilationTest("Test8_ProblematicInstanceScript", test8_ComplexInstanceScriptContent);

    // --- Tests with Explicit Braces --- 

    // Test 9: Braced Conditional (If/Else) - based on Test 3
    const test9_IfElse_Braced = `
x := 10
message := if x > 5 {
  "Greater"
} else {
  "Smaller or Equal"
}
y := if x == 10 then { "IsTen" } else { "NotTen" }
`;
    await runCivetCompilationTest("Test9_IfElse_Braced", test9_IfElse_Braced);

    // Test 10: Braced Multi-line arrow function - based on Test 6
    const test10_MultiLineArrow_Braced = `
complexAdd := (a, b) -> {
  c := a + b
  // Civet comment
  d := c * 2
  return d
}
`;
    await runCivetCompilationTest("Test10_MultiLineArrow_Braced", test10_MultiLineArrow_Braced);

    // Test 11: Braced Loop with Conditional - based on Test 7
    const test11_LoopWithIf_Braced = `
data := [1, 6, 3, 8]
processed := []
for val of data {
  if val > 5 {
    processed.push "big"
  } else {
    processed.push "small"
  }
}
`;
    await runCivetCompilationTest("Test11_LoopWithIf_Braced", test11_LoopWithIf_Braced);

    // Test 12: Problematic Instance Script section with Braces - based on Test 8
    const test12_ProblematicInstanceScript_Braced = `
  // Instance script with complex Civet
  instanceVar := "Hello from Complex Instance Civet!"
  console.log instanceVar

  // Conditional logic
  x := 10
  message := if x > 5 {
    "Greater than 5"
  } else {
    "Not greater than 5"
  }
  console.log message

  // Loop
  doubled := []
  for i of [1..3] {
    doubled.push i * 2
  }
  console.log doubled // [2, 4, 6]

  // Another destructuring example (already uses implicit blocks, no change needed here for braces)
  { propA, propB = "defaultB" } .= { propA: "ValueA" }
  console.log propA, propB
`;
    await runCivetCompilationTest("Test12_ProblematicInstanceScript_Braced", test12_ProblematicInstanceScript_Braced);

    // Test 13: Problematic Instance Script section with Braces - JS OUTPUT
    const test13_ProblematicInstanceScript_JS_Output_Content = test12_ProblematicInstanceScript_Braced; // Use same Civet
    await runCivetCompilationTest("Test13_Problematic_JS_Output", test13_ProblematicInstanceScript_JS_Output_Content, { js: true });

    // Test 14: Problematic Instance Script section INDENTATION STYLE - JS OUTPUT (based on Test 8)
    const test14_ProblematicInstanceScript_Indent_JS_Output_Content = test8_ComplexInstanceScriptContent; // Use Civet from Test 8
    await runCivetCompilationTest("Test14_Problematic_Indent_JS_Output", test14_ProblematicInstanceScript_Indent_JS_Output_Content, { js: true });

    console.log("\nAll micro-tests finished. Check individual files in ./micro_test_outputs/");
}

runAllTests().catch(err => {
    console.error("Error running tests:", err);
    process.exit(1);
});

// To run this: node ltools-backup/packages/svelte2tsx/test/test-current/run_civet_sourcemap_micro_tests.mjs 