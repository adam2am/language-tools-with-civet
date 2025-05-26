<script lang="civet">

    function funcForTest(name: string): string 
        console.log "hello, world"
    abc := "hello, world"

</script>
<div>
                     {abc}
    <button onclick={funcForTest}>Increment</button>
</div>