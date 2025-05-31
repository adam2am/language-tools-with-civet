<script lang="civet">
	number .= $state(1)
	
	propFunc := (b: number) =>
		number = number * b;
	
	twoPropsFunc := (ab: number, bc: number) =>
		number = ab * bc

	propFuncAllGood := (dv: number) =>
		number = number * dv;
	
	twoPropsFuncAllGood := (ty: number, ui: number) =>
		number = ty * ui;
</script>
<button onclick={() => propFunc(2)}>Increment</button>