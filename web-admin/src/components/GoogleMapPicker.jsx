"use client";
import React, { useEffect, useRef } from "react";

export default function GoogleMapPicker({ apiKey, initialLat, initialLng, radius, onLocationSelect }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const marker = useRef(null);
  const circle = useRef(null);

  useEffect(() => {
    // Dynamically load Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Dynamically load Leaflet JS
    if (!window.L && !document.getElementById("leaflet-script")) {
      const script = document.createElement("script");
      script.id = "leaflet-script";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = initMap;
      document.head.appendChild(script);
    } else if (window.L) {
      initMap();
    }

    function initMap() {
      if (!mapRef.current) return;
      if (leafletMap.current) return; // already initialized
      
      const center = [initialLat || -6.2088, initialLng || 106.845];
      
      // Initialize map
      leafletMap.current = window.L.map(mapRef.current).setView(center, 16);

      // Add dark mode OpenStreetMap tiles (CartoDB Dark Matter)
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(leafletMap.current);

      // Add marker
      marker.current = window.L.marker(center, { draggable: true }).addTo(leafletMap.current);

      // Add radius circle
      circle.current = window.L.circle(center, {
        color: '#38bdf8',
        fillColor: '#38bdf8',
        fillOpacity: 0.2,
        radius: radius || 15
      }).addTo(leafletMap.current);

      // Map click event
      leafletMap.current.on('click', (e) => {
        updatePosition(e.latlng.lat, e.latlng.lng);
      });

      // Marker drag event
      marker.current.on('dragend', (e) => {
        const pos = marker.current.getLatLng();
        updatePosition(pos.lat, pos.lng);
      });
    }

    function updatePosition(lat, lng) {
      const newPos = [lat, lng];
      marker.current.setLatLng(newPos);
      circle.current.setLatLng(newPos);
      if(onLocationSelect) onLocationSelect(lat, lng);
    }

  }, []);

  // Update circle radius dynamically if props change
  useEffect(() => {
    if(circle.current && window.L) {
      circle.current.setRadius(Number(radius) || 15);
    }
  }, [radius]);
  
  // Update map center dynamically if props change programmatically
  useEffect(() => {
    if(leafletMap.current && marker.current && circle.current && initialLat && initialLng && window.L) {
      const newPos = [initialLat, initialLng];
      leafletMap.current.setView(newPos);
      marker.current.setLatLng(newPos);
      circle.current.setLatLng(newPos);
    }
  }, [initialLat, initialLng]);

  return (
    <div ref={mapRef} style={{ width: "100%", height: "250px", borderRadius: "12px", background: "#0f172a", zIndex: 0 }}></div>
  );
}
