<script lang="civet">
	fruits := ["apple", "mango"]
	// no issue loop:
	for fruit in fruits
	  console.log `Fruit ${fruit}`
	
	// issue loop
	for fruit, indexdd in fruits
	  console.log `Fruit ${indexdd + 1}: ${fruit}`
</script>
<div>{fruits}</div> 