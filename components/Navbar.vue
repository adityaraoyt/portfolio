<script setup>

</script>

<template>
  <nav class="navbar">
    <ul class="navbar-list">
      <li class="navbar-item">
        <NuxtLink to="/" class="navbar-link">
          About
        </NuxtLink>
      </li>

      <li class="navbar-item">
        <NuxtLink to="/resume" class="navbar-link">
          Resume
        </NuxtLink>
      </li>

      <li class="navbar-item">
        <NuxtLink to="/portfolio" class="navbar-link">
          Portfolio
        </NuxtLink>
      </li>

      <li class="navbar-item">
        <NuxtLink to="/blog" class="navbar-link">
          Blog
        </NuxtLink>
      </li>

      <li class="navbar-item">
        <NuxtLink to="/contact" class="navbar-link">
          Contact
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
a.router-link-active {
  font-weight: bold;
}
a.router-link-exact-active {
  color: var(--vegas-gold);
}
</style>
