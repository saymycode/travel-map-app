<template>
  <div class="map-container">
    <div ref="mapElement" class="map-inner"></div>

    <!-- Kategori filtresi -->
    <!-- 🔁 Bu div haritanın üstüne sabit yerleşmiş bir filtre kutusudur -->
    <div class="category-filter">
      <select v-model="selectedCategory" class="category-select">
        <option value="">Tüm Kategoriler</option>
        <option v-for="cat in categories" :key="cat.id" :value="cat.id">
          {{ cat.name }}
        </option>
      </select>
    </div>


    <!-- Modern modal form -->
    <div v-if="showForm" class="modal-overlay" @click.self="cancelForm">
      <div class="modal-content" @click.stop>
        <h2 class="text-lg font-bold mb-4 text-gray-800">📍 Yeni Ziyaret Noktası</h2>
        <form @submit.prevent="submitForm">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <select v-model="form.category" required>
              <option disabled value="">Kategori seçin</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Ziyaret Tarihi</label>
            <input
              type="date"
              v-model="form.date"
              required
              class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" @click.prevent="cancelForm" class="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm transition-colors">Vazgeç</button>
            <button type="submit" @click.prevent="submitForm" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">Kaydet</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
/* global google */
import { onMounted, ref, reactive, onUnmounted, watch } from 'vue';
import api from '@/plugins/axios';

const categories = ref([]);
const selectedCategory = ref('');
const mapElement = ref(null);
const showForm = ref(false);
const form = reactive({ lat: null, lng: null, name: '', category: '', date: '', notes: '' });
const markers = ref([]);

let map;
let mapClickListener;

function getMarkerIcon(categoryId) {
  switch (parseInt(categoryId)) {
    case 0: return '/icons/cafe.png';
    case 1: return '/icons/museum.png';
    case 2: return '/icons/park.png';
    case 3: return '/icons/beach.png';
    default: return '/icons/default.png';
  }
}

function initMap() {
  map = new google.maps.Map(mapElement.value, {
    center: { lat: 38.4237, lng: 27.1428 },
    zoom: 10,
  });
  mapClickListener = map.addListener('click', (e) => {
    form.lat = e.latLng.lat();
    form.lng = e.latLng.lng();
    showForm.value = true;
  });
}

function cancelForm() {
  showForm.value = false;
  resetForm();
}

function resetForm() {
  form.lat = null;
  form.lng = null;
  form.category = '';
  form.date = '';
}

async function fetchCategories() {
  try {
    const res = await api.get('/visitedlocations/categories');
    categories.value = res.data;
  } catch (err) {
    console.error('Kategori verisi alınamadı:', err);
  }
}

async function loadMarkersFromApi() {
  try {
    const res = await api.get('/visitedlocations');
    markers.value.forEach(m => m.setMap(null));
    markers.value = [];

    res.data.forEach(loc => {
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        icon: {
          url: getMarkerIcon(loc.category),
          scaledSize: new google.maps.Size(32, 32),
        },
        title: `${loc.name} - ${loc.visitDate}`
      });
      marker.category = loc.category;
      marker.customCategoryId = loc.category;

      const infoWindow = new google.maps.InfoWindow({
        content: `<div><h3>${loc.name}</h3><p>Kategori: ${categories.value.find(c => c.id == loc.category)?.name || 'Bilinmiyor'}</p><p>Ziyaret Tarihi: ${new Date(loc.visitDate).toLocaleDateString()}</p><p>${loc.notes || ''}</p></div>`
      });

      marker.addListener('click', () => infoWindow.open(map, marker));
      markers.value.push(marker);
    });
  } catch (err) {
    console.error('Marker veri alınırken hata:', err);
  }
}

async function submitForm() {
  try {
    const payload = {
      name: 'Ziyaret Noktası',
      category: parseInt(form.category),
      latitude: form.lat,
      longitude: form.lng,
      visitDate: form.date,
      notes: form.notes
    };
    const res = await api.post('/visitedlocations', payload);

    const marker = new google.maps.Marker({
      position: { lat: form.lat, lng: form.lng },
      map: map,
      icon: {
        url: getMarkerIcon(form.category),
        scaledSize: new google.maps.Size(32, 32),
      },
      title: `${form.category} - ${form.date}`
    });
    marker.category = form.category;

    const infoWindow = new google.maps.InfoWindow({
      content: `<div><h3>${form.category}</h3><p>Tarih: ${form.date}</p></div>`
    });
    marker.addListener('click', () => infoWindow.open(map, marker));
    markers.value.push(marker);
    cancelForm();
  } catch (err) {
    console.error('Kayıt hatası:', err);
    alert('Bir hata oluştu');
  }
}

watch(selectedCategory, () => {
  markers.value.forEach(marker => {
    const markerCatId = parseInt(marker.customCategoryId); // 🔁 kategori ID'si

    if (!selectedCategory.value || markerCatId === parseInt(selectedCategory.value)) {
      marker.setMap(map);
    } else {
      marker.setMap(null);
    }
  });
});

function isValidLatLng(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

onMounted(() => {
  if (window.google && window.google.maps) {
    initMap();
    fetchCategories();
    loadMarkersFromApi();
  } else {
    const interval = setInterval(() => {
      if (window.google && window.google.maps) {
        clearInterval(interval);
        initMap();
        fetchCategories();
        loadMarkersFromApi();
      }
    }, 200);
  }
});

onUnmounted(() => {
  if (mapClickListener) {
    google.maps.event.removeListener(mapClickListener);
  }
});
</script>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
  height: 100vh;
  z-index: 1;
}

.map-inner {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999999;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  width: 100%;
  max-width: 400px;
  padding: 24px;
  position: relative;
  z-index: 1000000;
  animation: modalFadeIn 0.3s ease-out;
}
.category-filter {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 10000000; /* 🔼 çok yukarıda kalsın */
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 0.5rem 1rem;
}

.category-select {
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  font-size: 0.875rem;
  min-width: 150px;
}

@keyframes modalFadeIn {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>