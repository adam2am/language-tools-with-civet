<script lang="civet">
  function fooFunc() 
    foo := "foo"
    console.log foo
</script>

<template>
  <div>{fooFunc}</div>
  <p>{foo}</p>
</template> 