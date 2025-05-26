<script lang="civet" context="module">
  // Module level function
  export greet = (name: string): string =>
    if name == "Bot"
      return "Greetings, Bot!"
    else
      return "Hello, #{name}!"
</script>

<script lang="civet">
  // Instance script
  // Assuming greet is auto-imported for TS
  import { greet } from './module' // This would be a real import in a real file
  
  reactiveValue := 42
  message := greet(reactiveValue > 40 ? "Human" : "Bot")
  console.log message
  // Ensure blank lines and comments are handled
  // Another comment
</script>

<p>{message}</p>
