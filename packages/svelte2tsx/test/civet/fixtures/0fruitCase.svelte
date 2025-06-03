<script lang="civet">
	fruits := ["apple", "mango"]
	// issue loop
	for fruit1, index of fruits
		console.log `Fruit ${index + 1}: ${fruit1}`
	// great loop
	for fruit2 of fruits
		console.log `Fruit ${fruit2}`
	// great loop
	for fruit3, index2 in fruits
	  console.log `Fruit ${index2 + 1}: ${fruit3}`
</script>
<div>{fruits}</div> 