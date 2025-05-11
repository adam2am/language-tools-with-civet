<script lang="civet">
// This is a test file for Civet hover support in Svelte files

// Define a variable using Civet's := syntax
something := "something"

// Define a typed variable
typedValue: number := 42

// Define a function using Civet syntax
greet := (name: string): string ->
  `Hello, ${name}!`

// Define a class
class Person
  constructor: (@name: string, @age: number) ->
  
  sayHello: () ->
    console.log "Hello, my name is #{@name} and I'm #{@age} years old."

// Create an instance
person := new Person("John", 30)

// Export some values for use in the component
export { something, typedValue, greet, Person, person }
</script>

<script>
  // This is a regular JavaScript script block
  const regularVar = "I'm a regular JavaScript variable";
</script>

<main>
  <h1>Civet Hover Test</h1>
  <p>Value from Civet: {something}</p>
  <p>Typed value: {typedValue}</p>
  <p>{greet("World")}</p>
  <p>Person's name: {person.name}</p>
</main>

<style>
  main {
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>
