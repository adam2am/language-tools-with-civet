import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import ts from 'typescript';
import { ImplicitStoreValues } from './nodes/ImplicitStoreValues';
import { handleTypeAssertion } from './nodes/handleTypeAssertion';
import { Generics } from './nodes/Generics';
import { is$$EventsDeclaration } from './nodes/ComponentEvents';
import { throwError } from './utils/error';
import { is$$SlotsDeclaration } from './nodes/slot';
import { is$$PropsDeclaration } from './nodes/ExportedNames';

// Civet compilation should happen in svelte2tsx/index.ts before this function is called.
export interface ModuleAst {
    htmlx: string;
    tsAst: ts.SourceFile;
    astOffset: number;
}

export function createModuleAst(str: MagicString, script: Node): ModuleAst {
    const htmlx = str.original;
    const scriptContent = htmlx.substring(script.content.start, script.content.end);
    const tsAst = ts.createSourceFile(
        'component.module.ts.svelte',
        scriptContent,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );

    const astOffset = script.content.start;

    return { htmlx, tsAst, astOffset };
}



export function processModuleScriptTag(
    str: MagicString,
    script: Node, // estree-walker Node for the <script> tag
    implicitStoreValues: ImplicitStoreValues,
    moduleAst: ModuleAst
) {
    const localTsAst = moduleAst.tsAst;
    const localAstOffset = moduleAst.astOffset;
    
    // By the time this function is called, if the script was Civet, 
    // it should have already been compiled to TS by the main svelte2tsx function,
    // and moduleAst should be based on that TS code.
    // The lang/type attributes on the original script node might still say 'civet',
    // but the content in `str` and `moduleAst` is TS.

    const { htmlx } = moduleAst;
    const generics = new Generics(str, localAstOffset, script);

    // Check for generics attribute - original logic seems to handle this correctly by erroring 
    // as generics are typically for instance scripts. We need to ensure the `isCivet` check is removed from this path.
    // The original `if (generics.genericsAttr && !isCivet)` implies `isCivet` was a local variable.
    // Since Civet is pre-processed, we just check `generics.genericsAttr`.
    if (generics.genericsAttr) { 
        const start = htmlx.indexOf('generics', script.start);
        // This error might need adjustment if module scripts could somehow be valid with generics post-civet-compilation,
        // but the original intent was likely to disallow it for module scripts generally.
        throwError(
            start,
            start + 8,
            'The generics attribute is only allowed on the instance script',
            str.original
        );
    }

    const walk = (node: ts.Node) => {
        resolveImplicitStoreValue(node, implicitStoreValues, str, localAstOffset);
        generics.throwIfIsGeneric(node);
        throwIfIs$$EventsDeclaration(node, str, localAstOffset);
        throwIfIs$$SlotsDeclaration(node, str, localAstOffset);
        throwIfIs$$PropsDeclaration(node, str, localAstOffset);
        ts.forEachChild(node, (n) => walk(n));
    };

    localTsAst.forEachChild((n) => walk(n));
    implicitStoreValues.modifyCode(localAstOffset, str);

    str.overwrite(script.start, script.content.start, ';', { 
        contentOnly: true 
    });
    str.overwrite(script.content.end, script.end, ';', { 
        contentOnly: true
    });
}

function resolveImplicitStoreValue(
    node: ts.Node,
    implicitStoreValues: ImplicitStoreValues,
    str: MagicString,
    astOffset: number
) {
    if (ts.isVariableDeclaration(node)) {
        implicitStoreValues.addVariableDeclaration(node);
    }
    if (ts.isImportClause(node)) {
        implicitStoreValues.addImportStatement(node);
    }
    if (ts.isImportSpecifier(node)) {
        implicitStoreValues.addImportStatement(node);
    }
    if (ts.isTypeAssertionExpression?.(node)) {
        handleTypeAssertion(str, node, astOffset);
    }
}

function throwIfIs$$EventsDeclaration(node: ts.Node, str: MagicString, astOffset: number) {
    if (is$$EventsDeclaration(node)) {
        throw$$Error(node, str, astOffset, '$$Events');
    }
}

function throwIfIs$$SlotsDeclaration(node: ts.Node, str: MagicString, astOffset: number) {
    if (is$$SlotsDeclaration(node)) {
        throw$$Error(node, str, astOffset, '$$Slots');
    }
}

function throwIfIs$$PropsDeclaration(node: ts.Node, str: MagicString, astOffset: number) {
    if (is$$PropsDeclaration(node)) {
        throw$$Error(node, str, astOffset, '$$Props');
    }
}

function throw$$Error(node: ts.Node, str: MagicString, astOffset: number, type: string) {
    throwError(
        node.getStart() + astOffset, 
        node.getEnd() + astOffset,  
        `${type} can only be declared in the instance script`,
        str.original
    );
}
