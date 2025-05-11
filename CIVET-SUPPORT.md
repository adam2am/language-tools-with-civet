# Civet Support in Svelte Language Tools

This document describes how to use Civet in Svelte files with the Svelte Language Tools extension.

## Overview

Civet is a programming language that compiles to JavaScript or TypeScript. It's designed to be a more concise and expressive alternative to TypeScript, with features like the `:=` operator for variable declarations, arrow functions with the `->` syntax, and more.

The Svelte Language Tools extension now supports Civet in Svelte files, allowing you to use Civet syntax in `<script lang="civet">` tags and get proper syntax highlighting, hover information, and type checking.

## Requirements

To use Civet in Svelte files, you need:

1. The Svelte Language Tools extension for VS Code/Cursor
2. Civet extention for Vs Code/Cursor
3. The `svelte-preprocessor-with-civet` package installed in your project
4. Svelte configured to use the Civet preprocessor
