<script setup>
let isOpen = ref(false)

function toggleMenu() {
  isOpen = !isOpen
}
</script>

<template>
  <aside class="sidebar" :class="{ active: isOpen }">
    <div class="sidebar-info">
      <figure class="avatar-box">
        <img src="/images/my-avatar.png" alt="Aditya Rao" width="80">
      </figure>

      <div class="info-content">
        <h1 class="name" title="Aditya Rao">
          Aditya Rao
        </h1>

        <p class="title text-center xl:block flex items-center justify-center gap-1">
          <span class="xl:after:content-[''] after:content-[',']">ML Engineer</span>
          <span>Web developer</span>
        </p>
      </div>

      <button class="info_more-btn" @click="isOpen = !isOpen">
        <span>Show Contacts</span>

        <ion-icon name="chevron-down" />
      </button>
    </div>

    <div class="sidebar-info_more">
      <div class="separator" />

      <ul class="contacts-list">
        <li class="contact-item">
          <div class="icon-box">
            <ion-icon name="mail-outline" />
          </div>

          <div class="contact-info">
            <p class="contact-title">
              Email
            </p>

            <a href="mailto:arao87@asu.edu" class="contact-link">arao87@asu.edu</a>
          </div>
        </li>

        <li class="contact-item">
          <div class="icon-box">
            <ion-icon name="logo-github" />
          </div>

          <div class="contact-info">
            <p class="contact-title">
              Github
            </p>

            <a href="https://github.com/adityaraoyt" class="contact-link" target="_blank">adityaraoyt</a>
          </div>
        </li>

        <li class="contact-item">
          <div class="icon-box">
            <ion-icon name="logo-linkedin" />
          </div>

          <div class="contact-info">
            <p class="contact-title">
              Linkedin
            </p>

            <a href="https://linkedin.com/in/aditya-rao-dev" class="contact-link" target="_blank">Aditya Rao</a>
          </div>
        </li>
        <li class="contact-item">
          <div class="icon-box">
            <ion-icon name="logo-instagram" />
          </div>

          <div class="contact-info">
            <p class="contact-title">
              Instagram
            </p>

            <a href="https://www.instagram.com/__adityarao" class="contact-link" target="_blank">Aditya Rao</a>
          </div>
        </li>

        <li class="contact-item">
          <div class="icon-box">
            <ion-icon name="location-outline" />
          </div>

          <div class="contact-info">
            <p class="contact-title">
              Location
            </p>

            <address>Tempe, AZ</address>
          </div>
        </li>
      </ul>

      <div class="separator" />

      
    </div>
  </aside>
</template>
