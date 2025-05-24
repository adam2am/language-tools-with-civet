<script lang="civet">
  // Generate a random number between min and max (inclusive)
  generateRandomNumber := (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min
  
  // Simple condition example
  age := 25
  if age >= 18
    console.log "You are an adult"
  else
    console.log "You are a minor"
  
  // Array example
  fruits := ["apple",
   "banana", 
   "orange", 
   "grape", 
   "mango"]
  
  // Loop example
  for fruit, index of fruits
    console.log `Fruit ${index + 1}: ${fruit}`
  
  // Array with map
  numbers := [1, 2, 3, 4, 5]
  doubledNumbers := numbers.map (num) => num * 2
  
  // Filter example
  evenNumbers := numbers.filter (num) => num % 2 === 0
  
  // Reduce example
  sum := numbers.reduce ((acc, num) => acc + num), 0  

  // Nested function example
  nestedFunction := () =>
    do 
      do
        do 
          nestedVar := 123
          console.log "Nested function called"
  
  // Call nested function
  nestedFunction()
</script>

<p>{sum}</p>
