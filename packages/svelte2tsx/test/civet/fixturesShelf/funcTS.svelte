<script lang="ts">
  function funcForTest(name: string): string { 
    return "Hello, #{name}!"
  }
</script>

<p>{funcForTest("World")}</p>
