<script lang="civet">
	
	abfdsfc := "hello, world"
	line2 := "hello, world"

	function funcForTest() 
		console.log "hello, world"

	foo := () ->
		a := "comment"

	foo2 := () -> {
		a := "comment"
	}
	
</script>

<div>
	                 {line2}
	<button onclick={funcForTest}>Increment</button>
	<button onclick={foo2}>Increment</button>
</div>