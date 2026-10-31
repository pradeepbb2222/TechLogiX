import type { Product } from "./types";

/**
 * Sample catalog used until a real merchant/search API is integrated.
 * Server-side only. These are NOT live listings.
 */
export const SAMPLE_CATALOG: Product[] = [
  { id: "hp-1", name: "AeroTune ANC Headphones", merchant: "SoundHub", category: "headphones", price: 79.99, currency: "USD", rating: 4.4, reviews: 2310, deliveryDays: 3, highlights: ["Active noise cancelling", "30h battery", "USB-C"] },
  { id: "hp-2", name: "BassLine Wireless Over-Ear", merchant: "GadgetBarn", category: "headphones", price: 49.0, currency: "USD", rating: 4.1, reviews: 980, deliveryDays: 5, highlights: ["40h battery", "Foldable", "Bluetooth 5.3"] },
  { id: "hp-3", name: "StudioPro Reference Headphones", merchant: "AudioWorks", category: "headphones", price: 189.0, currency: "USD", rating: 4.8, reviews: 640, deliveryDays: 2, highlights: ["Hi-res audio", "Detachable cable", "Studio tuned"] },
  { id: "lp-1", name: "SwiftBook 14 Laptop", merchant: "TechDepot", category: "laptop", price: 649.0, currency: "USD", rating: 4.3, reviews: 1520, deliveryDays: 4, highlights: ["16GB RAM", "512GB SSD", "14\" FHD"] },
  { id: "lp-2", name: "ZenSlim Air 13", merchant: "LapMart", category: "laptop", price: 899.0, currency: "USD", rating: 4.6, reviews: 870, deliveryDays: 3, highlights: ["1.1kg", "18h battery", "OLED display"] },
  { id: "lp-3", name: "ValueNote 15", merchant: "TechDepot", category: "laptop", price: 429.0, currency: "USD", rating: 3.9, reviews: 2100, deliveryDays: 6, highlights: ["8GB RAM", "256GB SSD", "15.6\" HD"] },
  { id: "sh-1", name: "TrailRunner Running Shoes", merchant: "StrideCo", category: "shoes", price: 89.5, currency: "USD", rating: 4.5, reviews: 3400, deliveryDays: 3, highlights: ["Breathable mesh", "Cushioned sole", "Lightweight"] },
  { id: "sh-2", name: "CityWalk Sneakers", merchant: "UrbanSole", category: "shoes", price: 64.0, currency: "USD", rating: 4.2, reviews: 1290, deliveryDays: 4, highlights: ["Everyday comfort", "Water resistant", "Vegan leather"] },
  { id: "wt-1", name: "PulseFit Smartwatch", merchant: "GadgetBarn", category: "watch", price: 119.0, currency: "USD", rating: 4.2, reviews: 1750, deliveryDays: 4, highlights: ["Heart-rate tracking", "GPS", "7-day battery"] },
  { id: "wt-2", name: "ChronoLite Fitness Band", merchant: "SoundHub", category: "watch", price: 39.0, currency: "USD", rating: 4.0, reviews: 4200, deliveryDays: 2, highlights: ["Sleep tracking", "Water resistant", "14-day battery"] },
  { id: "kb-1", name: "ClickPro Mechanical Keyboard", merchant: "TechDepot", category: "keyboard", price: 74.0, currency: "USD", rating: 4.6, reviews: 1980, deliveryDays: 3, highlights: ["Hot-swappable", "RGB", "Wireless"] },
  { id: "kb-2", name: "QuietType Slim Keyboard", merchant: "LapMart", category: "keyboard", price: 35.0, currency: "USD", rating: 4.1, reviews: 760, deliveryDays: 5, highlights: ["Low profile", "Silent keys", "Multi-device"] },
];
