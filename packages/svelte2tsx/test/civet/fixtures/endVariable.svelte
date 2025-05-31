<script lang="civet">
	number .= $state(1)
	
	propFunc := (b: number) =>
		number = number * b;
	
	twoPropsFunc := (ab: number, bc: number) =>
		number = ab * bc
</script>
<button onclick={() => propFunc(2)}>Increment</button>