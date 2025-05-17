<script lang="civet">
    name := "World"
    addExclamation := (text: string) -> text + "!"

    // Intentionally introduce a type error for diagnostics testing
    //
    // Error: Operator '+' cannot be applied to types 'string' and 'number'.
    // numVar := 123
    // message := addExclamation(name) + numVar 
    
    message := addExclamation(name)


    // Function for definition and hover testing
    complexFunction := (a: number, b: string) ->
        intermediate := b + " processed " + a
        return intermediate

    
    finalOutput := complexFunction(42, "Input")
</script>

<h1>{message}</h1>

<p on:click={() => { console.log(addExclamation("Clicked")) }}>{finalOutput}</p>

<style>
    h1 {
        color: steelblue;
    }
</style> 