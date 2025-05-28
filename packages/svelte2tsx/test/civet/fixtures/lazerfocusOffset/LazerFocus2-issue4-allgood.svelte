<script lang="civet">
	foo1 := "hello, world"

	problematicFoo := "hello, world" // this is the issue
</script>

<div>
	{foo1}
	{problematicFoo}
</div>
