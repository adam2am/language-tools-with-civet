import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, 'micro_test_outputs');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

function getCurrentIndent(line) {
    let indent = 0;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === ' ') {
            indent++;
        } else if (line[i] === '\t') {
            indent += 4; // Assuming tab = 4 spaces, adjust as needed
        } else {
            break;
        }
    }
    return indent;
}

function preTransformCivetIndentsToBraces(civetCode) {
    const lines = civetCode.split('\n');
    const resultLines = [];
    const blockStack = []; // Stores { type: string, indent: number, originalLineIndent: number }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const trimmedLine = line.trim();
        const currentIndent = getCurrentIndent(line);

        let prefixForCurrentLine = "";

        // Close blocks if indentation decreases
        while (blockStack.length > 0 && currentIndent < blockStack[blockStack.length - 1].indent) {
            const blockToClose = blockStack.pop();
            const closingBrace = ' '.repeat(blockToClose.originalLineIndent) + '}';

            // Check if the current line can attach this closing brace
            if ((trimmedLine.startsWith('else if ') || (trimmedLine === 'else' && !trimmedLine.endsWith('{'))) &&
                blockToClose.type === 'if-else' &&
                currentIndent === blockToClose.originalLineIndent && 
                (blockStack.length === 0 || currentIndent >= blockStack[blockStack.length - 1].indent)
            ) {
                prefixForCurrentLine = closingBrace + ' ';
            } else {
                resultLines.push(closingBrace);
            }
        }

        // Handle the current line itself
        if (trimmedLine === '') {
            if (prefixForCurrentLine && prefixForCurrentLine.trim() !== '') {
                 // Avoid pushing only a prefix if the line is otherwise empty, unless it's just a brace.
                if (prefixForCurrentLine.trim() === '}') resultLines.push(prefixForCurrentLine.trim());
            }
            resultLines.push(line); // Push the empty line itself
            continue;
        }
        if (trimmedLine.startsWith('#')) { // Basic comment
            if (prefixForCurrentLine && prefixForCurrentLine.trim() !== '') {
                if (prefixForCurrentLine.trim() === '}') resultLines.push(prefixForCurrentLine.trim());
            }
            resultLines.push(line);
            continue;
        }

        let lineToPush = prefixForCurrentLine + line;

        if ((trimmedLine.startsWith('if ') || 
             trimmedLine.startsWith('else if ') ||
             (trimmedLine === 'else')) 
            && !trimmedLine.endsWith('{')) {
            lineToPush += ' {';
            let nextLineContentIndent = currentIndent + 2; 
            if (i + 1 < lines.length) {
                const nextLineActualIndent = getCurrentIndent(lines[i+1]);
                const nextTrimmedLine = lines[i+1].trim();
                if (nextTrimmedLine === '' && i + 2 < lines.length) { // lookahead past one blank line
                    const afterBlankIndent = getCurrentIndent(lines[i+2]);
                    if (afterBlankIndent > currentIndent) {
                        nextLineContentIndent = afterBlankIndent;
                    }
                } else if (nextLineActualIndent > currentIndent) {
                    nextLineContentIndent = nextLineActualIndent;
                }
            }
            blockStack.push({ type: 'if-else', indent: nextLineContentIndent, originalLineIndent: currentIndent });
        } else if (trimmedLine.endsWith('->') && !trimmedLine.endsWith('{')) {
            lineToPush += ' {';
            let nextLineContentIndent = currentIndent + 2;
            if (i + 1 < lines.length) { 
                const nextLineActualIndent = getCurrentIndent(lines[i+1]);
                 const nextTrimmedLine = lines[i+1].trim();
                if (nextTrimmedLine === '' && i + 2 < lines.length) { 
                    const afterBlankIndent = getCurrentIndent(lines[i+2]);
                    if (afterBlankIndent > currentIndent) {
                        nextLineContentIndent = afterBlankIndent;
                    }
                } else if (nextLineActualIndent > currentIndent) {
                    nextLineContentIndent = nextLineActualIndent;
                }
            }
            blockStack.push({ type: 'arrow', indent: nextLineContentIndent, originalLineIndent: currentIndent });
        } else if (trimmedLine.match(/^for\s.*\sof\s.*/) && !trimmedLine.endsWith('{')) {
            lineToPush += ' {';
            let nextLineContentIndent = currentIndent + 2;
            if (i + 1 < lines.length) { 
                const nextLineActualIndent = getCurrentIndent(lines[i+1]);
                 const nextTrimmedLine = lines[i+1].trim();
                if (nextTrimmedLine === '' && i + 2 < lines.length) { 
                    const afterBlankIndent = getCurrentIndent(lines[i+2]);
                    if (afterBlankIndent > currentIndent) {
                        nextLineContentIndent = afterBlankIndent;
                    }
                } else if (nextLineActualIndent > currentIndent) {
                    nextLineContentIndent = nextLineActualIndent;
                }
            }
            blockStack.push({ type: 'for', indent: nextLineContentIndent, originalLineIndent: currentIndent });
        }
        
        resultLines.push(lineToPush);
    }

    // Close any remaining open blocks
    while (blockStack.length > 0) {
        const block = blockStack.pop();
        resultLines.push(' '.repeat(block.originalLineIndent) + '}');
    }
    
    return resultLines.join('\n');
}

function runIndentToBraceTest(testName, inputCivetIndented, expectedCivetBraced) {
    const logFilePath = path.join(outputDir, `${testName.replace(/\s+/g, '_')}_indent_to_brace_output.log`);
    let logOutput = `Running Indent-to-Brace Test: ${testName}\n`;
    logOutput += "============================================================\n";
    console.log(`\nRunning Indent-to-Brace Test: ${testName}`);
    console.log("============================================================");

    logOutput += "Input Civet (Indented):\n";
    logOutput += "------------------------------------------------------------\n";
    logOutput += inputCivetIndented + "\n";
    logOutput += "------------------------------------------------------------\n\n";

    console.log("Input Civet (Indented):");
    console.log("------------------------------------------------------------");
    console.log(inputCivetIndented);
    console.log("------------------------------------------------------------");

    logOutput += "Expected Civet (Braced):\n";
    logOutput += "------------------------------------------------------------\n";
    logOutput += expectedCivetBraced + "\n";
    logOutput += "------------------------------------------------------------\n\n";

    console.log("\nExpected Civet (Braced):");
    console.log("------------------------------------------------------------");
    console.log(expectedCivetBraced);
    console.log("------------------------------------------------------------");

    const actualCivetBraced = preTransformCivetIndentsToBraces(inputCivetIndented);

    logOutput += "Actual Civet (Braced):\n";
    logOutput += "------------------------------------------------------------\n";
    logOutput += actualCivetBraced + "\n";
    logOutput += "------------------------------------------------------------\n\n";

    console.log("\nActual Civet (Braced):");
    console.log("------------------------------------------------------------");
    console.log(actualCivetBraced);
    console.log("------------------------------------------------------------");

    try {
        assert.strictEqual(actualCivetBraced.trim(), expectedCivetBraced.trim(), "Transformation mismatch");
        logOutput += "Test PASSED\n";
        console.log("\nTest PASSED");
    } catch (e) {
        logOutput += `Test FAILED: ${e.message}\n`;
        console.error("\nTest FAILED:", e.message);
    }

    logOutput += "============================================================\n\n";
    fs.appendFileSync(logFilePath, logOutput);
    console.log(`Indent-to-Brace test output saved to: ${logFilePath}`);
}

// --- Define and Run Tests ---

// Test 1: Simple If
const test1_SimpleIf_Input = `
if condition
  doSomething()
`;
const test1_SimpleIf_Expected = `
if condition {
  doSomething()
}
`;
runIndentToBraceTest("Test1_SimpleIf", test1_SimpleIf_Input, test1_SimpleIf_Expected);

// Test 2: If-Else
const test2_IfElse_Input = `
if condition
  doSomething()
else
  doSomethingElse()
`;
const test2_IfElse_Expected = `
if condition {
  doSomething()
} else {
  doSomethingElse()
}
`;
runIndentToBraceTest("Test2_IfElse", test2_IfElse_Input, test2_IfElse_Expected);

// Test 3: Arrow Function
const test3_Arrow_Input = `
myFunc := (a, b) ->
  c := a + b
  return c
`;
const test3_Arrow_Expected = `
myFunc := (a, b) -> {
  c := a + b
  return c
}
`;
runIndentToBraceTest("Test3_ArrowFunc", test3_Arrow_Input, test3_Arrow_Expected);

// Test 4: For...of loop
const test4_ForLoop_Input = `
items := [1, 2, 3]
for item of items
  process(item)
`;
const test4_ForLoop_Expected = `
items := [1, 2, 3]
for item of items {
  process(item)
}
`;
runIndentToBraceTest("Test4_ForOfLoop", test4_ForLoop_Input, test4_ForLoop_Expected);

// Test 5: If-ElseIf-Else
const test5_IfElseIf_Input = `
if condition1
  doA()
else if condition2
  doB()
else
  doC()
`;
const test5_IfElseIf_Expected = `
if condition1 {
  doA()
} else if condition2 {
  doB()
} else {
  doC()
}
`;
runIndentToBraceTest("Test5_IfElseIfElse", test5_IfElseIf_Input, test5_IfElseIf_Expected);


console.log("\nAll Indent-to-Brace micro-tests finished. Check individual files in ./micro_test_outputs/");

// To run this: node ltools-backup/packages/svelte2tsx/test/test-current/run_indent_to_brace_micro_tests.mjs
