<script lang="civet">
	value .= $state(10)
	process := (x: number) => // x is single char
		value = value * x;
</script>

<p>{alphaState}</p>
<button onclick={() => recalculate(3)}>Test</button> 