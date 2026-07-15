import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import mixpanel from "mixpanel-browser";
import { 
  Handshake, MessageSquare, User, Plus, Search, MapPin, Navigation, 
  Send, Heart, ThumbsUp, Calendar, AlertCircle, Share2, Info, Eye, 
  Settings, ShieldAlert, CheckCircle2, PhoneCall, RotateCw, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  collection, addDoc, updateDoc, doc, onSnapshot, 
  query, orderBy, getDoc, setDoc, limit, getDocs, increment
} from "firebase/firestore";
import { db, auth, isFirebaseAvailable } from "./firebase";
import { signInAnonymously } from "firebase/auth";


// Types
interface Publication {
  id: string;
  type: "offer" | "search";
  title: string;
  category: string;
  condition: string;
  dealType: string;
  description: string;
  location: {
    lat: number;
    lng: number;
    name: string;
  };
  contactPhone: string;
  contactEmail?: string;
  contactName: string;
  imageUrl: string;
  timestamp: number;
  views: number;
}

interface BlogPost {
  id: string;
  title: string;
  content: string;
  author: string;
  category: string;
  timestamp: number;
  likes: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  message: string;
  publicationId: string;
  timestamp: number;
}

const PRESET_IMAGES = [
  { name: "Tecnología / Consola", url: "https://images.unsplash.com/photo-1507457379470-08b8006b2245?w=600&auto=format&fit=crop" },
  { name: "Bicicleta", url: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&auto=format&fit=crop" },
  { name: "Guitarra", url: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&auto=format&fit=crop" },
  { name: "Muebles / Mesa", url: "https://images.unsplash.com/photo-1577140917170-285929fb55b7?w=600&auto=format&fit=crop" },
  { name: "Bebés / Cochecito", url: "https://images.unsplash.com/photo-1594782078968-2b07656d7bb2?w=600&auto=format&fit=crop" },
  { name: "Celular", url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop" },
  { name: "Libros", url: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&auto=format&fit=crop" },
  { name: "Ropa / Zapatillas", url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop" },
  { name: "Herramientas", url: "https://images.unsplash.com/photo-1581147036324-c17da419a642?w=600&auto=format&fit=crop" }
];

export default function App() {
  // Tabs & Navigation
  const [activeTab, setActiveTab] = useState<"market" | "blog" | "chat">("market");
  
  // Data State
  const [publications, setPublications] = useState<Publication[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [totalVisits, setTotalVisits] = useState<number>(0);
  
  // Filtering & Search
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [mapSearchText, setMapSearchText] = useState<string>("");
  
  // Selected item modal / details
  const [selectedPub, setSelectedPub] = useState<Publication | null>(null);
  
  // Create Publication States
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newPubType, setNewPubType] = useState<"offer" | "search">("offer");
  const [newPubTitle, setNewPubTitle] = useState<string>("");
  const [newPubCategory, setNewPubCategory] = useState<string>("Tecnología & Videojuegos");
  const [newPubCondition, setNewPubCondition] = useState<string>("Usado / Muy bueno");
  const [newPubDealType, setNewPubDealType] = useState<string>("Solo Trueque (Intercambio directo)");
  const [newPubDesc, setNewPubDesc] = useState<string>("");
  const [newPubLocationName, setNewPubLocationName] = useState<string>("Palermo, CABA");
  const [newPubLat, setNewPubLat] = useState<number>(-34.5889);
  const [newPubLng, setNewPubLng] = useState<number>(-58.4306);
  const [newPubPhone, setNewPubPhone] = useState<string>("");
  const [newPubEmail, setNewPubEmail] = useState<string>("");
  const [newPubName, setNewPubName] = useState<string>("");
  const [newPubImageUrl, setNewPubImageUrl] = useState<string>(PRESET_IMAGES[0].url);
  const [isSelectingLocationOnMap, setIsSelectingLocationOnMap] = useState<boolean>(false);
  
  // Edit Publication States
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingPubId, setEditingPubId] = useState<string | null>(null);
  
  // Create Blog Post States
  const [showCreateBlogModal, setShowCreateBlogModal] = useState<boolean>(false);
  const [newBlogTitle, setNewBlogTitle] = useState<string>("");
  const [newBlogCategory, setNewBlogCategory] = useState<string>("Testimonio");
  const [newBlogContent, setNewBlogContent] = useState<string>("");
  const [newBlogAuthor, setNewBlogAuthor] = useState<string>("");

  // Mixpanel custom token & live event debugger state
  const [customMixpanelToken, setCustomMixpanelToken] = useState<string>(() => {
    return localStorage.getItem("trueque_mixpanel_token") || "";
  });
  const [liveEvents, setLiveEvents] = useState<any[]>([]);

  // Rotating trades carousel state and data
  const [activeTradeIndex, setActiveTradeIndex] = useState<number>(0);
  const tradesCarousel = [
    {
      have: "Bicicleta de Montaña",
      haveIcon: "🚲",
      want: "Guitarra Acústica",
      wantIcon: "🎸",
      color: "from-cyan-400 to-blue-500",
      offerColor: "bg-cyan-500/20 text-cyan-200 border-cyan-400/30",
      wantColor: "bg-blue-500/20 text-blue-200 border-blue-400/30"
    },
    {
      have: "Televisor Smart 4K",
      haveIcon: "📺",
      want: "Consola de Videojuegos",
      wantIcon: "🎮",
      color: "from-pink-500 to-rose-500",
      offerColor: "bg-pink-500/20 text-pink-200 border-pink-400/30",
      wantColor: "bg-rose-500/20 text-rose-200 border-rose-400/30"
    },
    {
      have: "Sillón Retro Cómodo",
      haveIcon: "🛋️",
      want: "Estante de Libros",
      wantIcon: "📚",
      color: "from-emerald-400 to-teal-500",
      offerColor: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
      wantColor: "bg-teal-500/20 text-teal-200 border-teal-400/30"
    },
    {
      have: "Cafetera de Grano",
      haveIcon: "☕",
      want: "Cámara Réflex Profesional",
      wantIcon: "📷",
      color: "from-amber-400 to-orange-500",
      offerColor: "bg-amber-500/20 text-amber-200 border-amber-400/30",
      wantColor: "bg-orange-500/20 text-orange-200 border-orange-400/30"
    },
    {
      have: "Planta de Interior Monstera",
      haveIcon: "🌱",
      want: "Herramientas de Jardinería",
      wantIcon: "✂️",
      color: "from-green-400 to-emerald-500",
      offerColor: "bg-green-500/20 text-green-200 border-green-400/30",
      wantColor: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTradeIndex((prev) => (prev + 1) % tradesCarousel.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Chat/Conversation state
  const [activeChatPub, setActiveChatPub] = useState<Publication | null>(null);
  const [chatInputText, setChatInputText] = useState<string>("");

  // Local user settings & Owner exclusion
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [excludeSelf, setExcludeSelf] = useState<boolean>(false);
  const [showProfileConfig, setShowProfileConfig] = useState<boolean>(false);
  
  // Map References
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const currentSelectMarkerRef = useRef<L.Marker | null>(null);

  // Initialize User Identity & Exclude State
  useEffect(() => {
    // Session ID for visit counts
    let session = localStorage.getItem("trueque_sessionId");
    if (!session) {
      session = "sess_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem("trueque_sessionId", session);
    }

    // User ID
    let uid = localStorage.getItem("trueque_userId");
    if (!uid) {
      uid = "user_" + Math.random().toString(36).substring(2, 12);
      localStorage.setItem("trueque_userId", uid);
    }
    setUserId(uid);

    // User Name
    let uName = localStorage.getItem("trueque_userName");
    if (!uName) {
      uName = "Vecino/a " + Math.floor(Math.random() * 900 + 100);
      localStorage.setItem("trueque_userName", uName);
    }
    setUserName(uName);

    // AUTO-EXCLUDE DEVELOPER HOSTNAMES
    const isDevHost = window.location.hostname.includes("localhost") || 
                      window.location.hostname.includes("ais-dev-") ||
                      window.location.hostname.includes("127.0.0.1") ||
                      window.location.hostname.includes("ai.studio");
                       
    let isExcluded = localStorage.getItem("exclude_visit") === "true";
    if (isDevHost && localStorage.getItem("exclude_visit") === null) {
      localStorage.setItem("exclude_visit", "true");
      isExcluded = true;
    }
    setExcludeSelf(isExcluded);

    // Initialize Mixpanel
    try {
      const savedToken = localStorage.getItem("trueque_mixpanel_token") || "";
      const MIXPANEL_TOKEN = savedToken.trim() || (import.meta as any).env?.VITE_MIXPANEL_TOKEN || "mixpanel_fallback_trueque";
      mixpanel.init(MIXPANEL_TOKEN, {
        track_pageview: true,
        persistence: "localStorage"
      });
      // Identify user
      mixpanel.identify(uid);
      mixpanel.people.set({
        "$name": uName,
        "Is Owner (Excluded)": isExcluded,
        "Mixpanel Token Type": savedToken.trim() ? "custom_ui" : "default_env"
      });
      
      // Track initial load
      mixpanel.track("App Loaded", {
        userId: uid,
        userName: uName,
        isOwnerExcluded: isExcluded,
        hostname: window.location.hostname
      });

      setLiveEvents([{
        name: "App Loaded",
        props: { userId: uid, userName: uName, isOwnerExcluded: isExcluded, hostname: window.location.hostname },
        id: "loaded_" + Date.now(),
        time: new Date().toLocaleTimeString()
      }]);
    } catch (err) {
      console.warn("Mixpanel failed to initialize", err);
    }
  }, []);

  // Helper tracker
  const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    try {
      const isExcluded = localStorage.getItem("exclude_visit") === "true";
      const props = {
        ...properties,
        userId,
        userName,
        isOwner: isExcluded,
        sessionId: localStorage.getItem("trueque_sessionId"),
        timestamp: new Date().toISOString()
      };
      mixpanel.track(eventName, props);
      console.log(`[Mixpanel Track] ${eventName}:`, props);

      // Add to Live Debugger stream
      setLiveEvents(prev => [
        { name: eventName, props, id: Math.random().toString(36).substring(7), time: new Date().toLocaleTimeString() },
        ...prev
      ].slice(0, 10));
    } catch (err) {
      console.warn("Tracking failed", err);
    }
  };

  // 1. Fetch persistent data & increment visits on mount
  useEffect(() => {
    if (!isFirebaseAvailable) return;

    // Login anonymously
    signInAnonymously(auth)
      .then((userCred) => {
        const uid = userCred.user.uid;
        console.log("Logged in anonymously with ID:", uid);
      })
      .catch((err) => {
        console.warn("Notice: Anonymous Auth is restricted in the Firebase Console. Standard guest fallback active.", err);
      });

    // Handle visits increment
    const hasRegisteredVisit = sessionStorage.getItem("has_registered_visit") === "true";
    const isExcluded = localStorage.getItem("exclude_visit") === "true";

    if (isExcluded) {
      console.log("Excluding visit increment for the developer/admin.");
      sessionStorage.setItem("has_registered_visit", "true");
      if (!hasRegisteredVisit) {
        trackEvent("App Visit Admin", { email: "" });
      }
    } else {
      if (!hasRegisteredVisit) {
        sessionStorage.setItem("has_registered_visit", "true");
        trackEvent("App Visit");
        
        const visitsDocRef = doc(db, "stats", "global");
        getDoc(visitsDocRef)
          .then((snap) => {
            if (snap.exists()) {
              const currentVisits = snap.data().visits || 0;
              setDoc(visitsDocRef, { visits: currentVisits + 1 }, { merge: true });
            } else {
              setDoc(visitsDocRef, { visits: 3128 }, { merge: true });
            }
          })
          .catch((err) => {
            console.error("Error updating global visits:", err);
          });
      }
    }

    // Subscribe to total visits count in real-time
    const visitsDocRef = doc(db, "stats", "global");
    const unsubscribeVisits = onSnapshot(visitsDocRef, (snap) => {
      if (snap.exists()) {
        setTotalVisits(snap.data().visits || 3128);
      } else {
        setTotalVisits(3128);
      }
    }, (err) => {
      console.warn("Could not listen to real-time stats, using local fallback counter:", err);
      setTotalVisits(3128);
    });

    // Subscribe to publications in real-time
    const productsQuery = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubscribePublications = onSnapshot(productsQuery, (snapshot) => {
      const prodList: Publication[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        // Map Firestore flat fields (latitude, longitude, locationName) to component types
        prodList.push({
          id: docSnap.id,
          type: data.type === "ofrecimiento" ? "offer" : "search", // handle conversion if stored as ofrecemos/buscamos
          title: data.title || "",
          category: data.category || "Otros",
          condition: data.condition || "Usado",
          dealType: data.dealType || "Solo Trueque",
          description: data.description || "",
          location: {
            lat: data.latitude !== undefined ? data.latitude : (data.location?.lat || -34.5889),
            lng: data.longitude !== undefined ? data.longitude : (data.location?.lng || -58.4306),
            name: data.locationName || (data.location?.name || "CABA")
          },
          contactPhone: data.contactPhone || "",
          contactEmail: data.contactEmail || "",
          contactName: data.contactName || "Vecino",
          imageUrl: data.imageUrl || "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop",
          timestamp: typeof data.createdAt === "number" ? data.createdAt : (data.timestamp || Date.now()),
          views: data.views || 0
        });
      });
      
      // If publications are empty, let's seed default ones!
      if (snapshot.empty) {
        console.log("No publications found. Seeding initial community listings...");
        // Seed default items from our mock list to make sure the app has great content initially
        const defaultListings = [
          {
            title: "Bicicleta Rodado 26 Shimano",
            type: "ofrecimiento",
            category: "Deportes & Aire Libre",
            condition: "Usado",
            dealType: "Solo Trueque (Intercambio directo)",
            description: "Bicicleta rodado 26 en muy buen estado general. Tiene cambios de 18 velocidades Shimano. La cambio por herramientas de carpintería o alguna amoladora angular.",
            latitude: -34.5889,
            longitude: -58.4306,
            locationName: "Palermo, CABA",
            contactPhone: "+5491112345678",
            contactName: "Carlos R.",
            imageUrl: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&auto=format&fit=crop",
            createdAt: Date.now() - 3600000 * 24 * 3,
            views: 45
          },
          {
            title: "PlayStation 3 Slim 250GB (2 Joysticks)",
            type: "ofrecimiento",
            category: "Tecnología & Videojuegos",
            condition: "Usado / Muy bueno",
            dealType: "Trueque o Venta (Negociable)",
            description: "Consola PS3 Slim de 250GB, viene flasheada con Hen, incluye 2 joysticks originales y 5 juegos físicos. La canjeo por celular Android de igual valor o herramientas eléctricas.",
            latitude: -34.6621,
            longitude: -58.3653,
            locationName: "Avellaneda, GBA Sur",
            contactPhone: "+5491123456789",
            contactName: "Sofía M.",
            imageUrl: "https://images.unsplash.com/photo-1507457379470-08b8006b2245?w=600&auto=format&fit=crop",
            createdAt: Date.now() - 3600000 * 12,
            views: 78
          },
          {
            title: "Mesa y 4 Sillas de Algarrobo macizo",
            type: "ofrecimiento",
            category: "Hogar & Muebles",
            condition: "Usado / Buen estado",
            dealType: "Solo Trueque (Intercambio directo)",
            description: "Mesa de comedor de algarrobo macizo pesada, con 4 sillas haciendo juego. La canjeo por cocina a gas de 4 hornallas que funcione impecable.",
            latitude: -34.6514,
            longitude: -58.6212,
            locationName: "Morón, GBA Oeste",
            contactPhone: "+5491134567890",
            contactName: "Juan Ignacio",
            imageUrl: "https://images.unsplash.com/photo-1577140917170-285929fb55b7?w=600&auto=format&fit=crop",
            createdAt: Date.now() - 3600000 * 48,
            views: 32
          }
        ];
        defaultListings.forEach(item => {
          addDoc(collection(db, "products"), item);
        });
      }

      setPublications(prodList);
    }, (err) => {
      console.error("Error listening to products collection:", err);
    });

    // Subscribe to blog posts in real-time
    const blogQuery = query(collection(db, "blog_posts"), orderBy("createdAt", "desc"));
    const unsubscribeBlog = onSnapshot(blogQuery, (snapshot) => {
      const posts: BlogPost[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        posts.push({
          id: docSnap.id,
          title: data.title || "",
          content: data.content || "",
          author: data.authorName || data.author || "Vecino Anónimo",
          category: data.category || "General",
          timestamp: typeof data.createdAt === "string" ? new Date(data.createdAt).getTime() : (data.timestamp || Date.now()),
          likes: data.likes || 0
        });
      });

      // Seeding blog posts if empty
      if (snapshot.empty) {
        console.log("Blog collection is empty. Auto-seeding default community posts...");
        const Kie = [
          {
            title: "¡Mi primer gran trueque de la temporada!",
            content: "Hoy logré intercambiar mi vieja guitarra acústica por una bicicleta plegable con Javier, un vecino que vive a solo tres cuadras. Ambos quedamos felices: él vuelve a la música y yo podré pedalear al trabajo. ¡Esta comunidad realmente funciona!",
            authorName: "Carolina Gómez",
            authorId: "system_caro",
            createdAt: new Date(Date.now() - 36e5 * 24 * 2).toISOString(),
            category: "Trueques Exitosos",
            likes: 12,
            likedBy: [],
            emoji: "🚲"
          },
          {
            title: "5 Consejos para un trueque seguro y feliz",
            content: `1. Describe el estado de tus cosas con total honestidad.\n2. Reúnete siempre en lugares públicos, iluminados o concurridos (¡el Parque Central es ideal!).\n3. Limpia y desinfecta los objetos antes de entregarlos.\n4. Conversa los detalles del trato antes de juntarse.\n5. Califica a tu compañero de trueque para ayudar a otros vecinos.`,
            authorName: "Administrador",
            authorId: "system_admin",
            createdAt: new Date(Date.now() - 36e5 * 24 * 5).toISOString(),
            category: "Consejos & Guías",
            likes: 28,
            likedBy: [],
            emoji: "💡"
          },
          {
            title: "Eco-trueque: Reduciendo nuestra huella de carbono",
            content: "Intercambiar libros, ropa y herramientas no solo cuida el bolsillo, sino que reduce significativamente el volumen de residuos que enviamos a los vertederos. Cada objeto reutilizado es una victoria para el planeta. ¡Sigamos impulsando el trueque en nuestra ciudad!",
            authorName: "Felipe Valenzuela",
            authorId: "system_felipe",
            createdAt: new Date(Date.now() - 36e5 * 24 * 10).toISOString(),
            category: "Reciclaje & Eco",
            likes: 19,
            likedBy: [],
            emoji: "🌱"
          }
        ];
        Kie.forEach(post => {
          addDoc(collection(db, "blog_posts"), post);
        });
      }

      setBlogPosts(posts);
    }, (err) => {
      console.error("Error listening to blog posts:", err);
    });

    // Subscribe to chat messages in real-time
    const messagesQuery = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({
          id: docSnap.id,
          senderId: data.senderId || "",
          senderName: data.senderName || "",
          receiverId: data.receiverId || "",
          message: data.message || "",
          publicationId: data.publicationId || "",
          timestamp: data.timestamp || Date.now()
        });
      });
      setMessages(msgs);
    }, (err) => {
      console.error("Error listening to messages:", err);
    });

    return () => {
      unsubscribeVisits();
      unsubscribePublications();
      unsubscribeBlog();
      unsubscribeMessages();
    };
  }, [excludeSelf]);


  // 2. Setup Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Map centered in Buenos Aires
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([-34.6037, -58.3816], 11);
    
    mapRef.current = map;

    // OpenStreetMap Tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Layers for publication markers
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    // Map Click Listener (mainly for picking coordinates)
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      // Update coordinates
      setNewPubLat(lat);
      setNewPubLng(lng);

      if (currentSelectMarkerRef.current) {
        currentSelectMarkerRef.current.setLatLng(e.latlng);
      } else {
        const marker = L.marker(e.latlng, {
          icon: L.divIcon({
            className: "select-pin",
            html: `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;background:#f97316;border:2px solid white;border-radius:50%;color:white;font-weight:bold;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.3)">📍</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(map);
        currentSelectMarkerRef.current = marker;
      }
      
      // Attempt to geocode coordinate roughly
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.suburb || "Buenos Aires";
            const neighborhood = data.address.neighbourhood || data.address.road || city;
            setNewPubLocationName(`${neighborhood}, ${city}`);
          }
        })
        .catch(() => {
          setNewPubLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        });
    });

    return () => {
      map.remove();
    };
  }, []);

  // Update map markers when publications list, filter or search query changes
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    // Clear previous markers
    markersLayerRef.current.clearLayers();

    // Filter publications
    const filtered = publications.filter(pub => {
      const matchCategory = selectedCategory === "all" || pub.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchQuery = pub.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         pub.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         pub.location.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchQuery;
    });

    // Add new markers
    filtered.forEach(pub => {
      if (!pub.location || typeof pub.location.lat !== "number") return;

      const markerColor = pub.type === "offer" ? "#00b159" : "#3b82f6";
      const markerLetter = pub.type === "offer" ? "O" : "B"; // Ofrecido vs Buscado

      const customIcon = L.divIcon({
        className: "custom-cluster-marker",
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background-color: ${markerColor};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 4px 6px rgba(0,0,0,0.25);
            color: white;
            font-weight: 800;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease-in-out;
          " class="hover:scale-110">
            ${markerLetter}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([pub.location.lat, pub.location.lng], { icon: customIcon });
      
      // Bind descriptive popup
      const popupContent = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px; width: 180px;">
          <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #1e1b4b;">${pub.title}</h4>
          <span style="font-size: 10px; background-color: ${pub.type === "offer" ? "#dcfce7" : "#dbeafe"}; color: ${pub.type === "offer" ? "#166534" : "#1e40af"}; padding: 1px 6px; border-radius: 9999px; font-weight: 600;">
            ${pub.type === "offer" ? "Ofrece" : "Busca"}
          </span>
          <p style="margin: 6px 0 0 0; font-size: 11px; color: #4b5563;">📍 ${pub.location.name}</p>
          <button id="btn-popup-${pub.id}" style="margin-top: 8px; width: 100%; background: #5839fa; color: white; border: none; padding: 3px; font-size: 11px; border-radius: 4px; cursor: pointer; font-weight: bold;">
            Ver Detalles
          </button>
        </div>
      `;
      marker.bindPopup(popupContent);

      marker.on("popupopen", () => {
        const btn = document.getElementById(`btn-popup-${pub.id}`);
        if (btn) {
          btn.addEventListener("click", () => {
            handleViewPublication(pub);
          });
        }
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [publications, selectedCategory, searchQuery]);

  // View publication details
  const handleViewPublication = (pub: Publication) => {
    setSelectedPub(pub);
    trackEvent("View Publication Details", { id: pub.id, title: pub.title, type: pub.type });

    // Increment view counter in Firestore
    const isExcluded = localStorage.getItem("exclude_visit") === "true";
    if (!isExcluded) {
      const productRef = doc(db, "products", pub.id);
      updateDoc(productRef, { views: increment(1) })
        .then(() => {
          setSelectedPub(curr => curr && curr.id === pub.id ? { ...curr, views: (curr.views || 0) + 1 } : curr);
        })
        .catch(err => console.error("Error updating views in Firestore:", err));
    }
  };

  // Open Create Modal Helper
  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setEditingPubId(null);
    setNewPubType("offer");
    setNewPubTitle("");
    setNewPubCategory("Tecnología & Videojuegos");
    setNewPubCondition("Usado / Muy bueno");
    setNewPubDealType("Solo Trueque (Intercambio directo)");
    setNewPubDesc("");
    setNewPubLocationName("Palermo, CABA");
    setNewPubLat(-34.5889);
    setNewPubLng(-58.4306);
    // Use saved username from profile if present
    const savedName = localStorage.getItem("trueque_userName") || "";
    setNewPubName(savedName || "");
    setNewPubPhone("");
    setNewPubEmail("");
    setNewPubImageUrl(PRESET_IMAGES[0].url);
    setShowCreateModal(true);
    trackEvent("Form Open Create");
  };

  // Open Edit Modal Helper
  const handleEditPublication = (pub: Publication) => {
    setIsEditing(true);
    setEditingPubId(pub.id);
    setNewPubType(pub.type);
    setNewPubTitle(pub.title);
    setNewPubCategory(pub.category);
    setNewPubCondition(pub.condition);
    setNewPubDealType(pub.dealType);
    setNewPubDesc(pub.description);
    setNewPubLocationName(pub.location.name);
    setNewPubLat(pub.location.lat);
    setNewPubLng(pub.location.lng);
    setNewPubPhone(pub.contactPhone);
    setNewPubEmail(pub.contactEmail || "");
    setNewPubName(pub.contactName);
    setNewPubImageUrl(pub.imageUrl);
    
    setShowCreateModal(true);
    setSelectedPub(null); // Close the detail view to focus on editing
    trackEvent("Form Open Edit", { id: pub.id });
  };

  // Close Create/Edit Modal Helper
  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setIsEditing(false);
    setEditingPubId(null);
    setNewPubEmail("");
    trackEvent("Form Closed");
  };

  // Submit publication (Creates or Updates)
  const handleCreatePublication = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPubTitle.trim() || !newPubDesc.trim() || !newPubPhone.trim() || !newPubName.trim()) {
      alert("Por favor completa los campos obligatorios (*)");
      return;
    }

    if (isEditing && editingPubId) {
      const payload = {
        type: newPubType === "offer" ? "ofrecimiento" : "busqueda",
        title: newPubTitle,
        category: newPubCategory,
        condition: newPubCondition,
        dealType: newPubDealType,
        description: newPubDesc,
        latitude: newPubLat,
        longitude: newPubLng,
        locationName: newPubLocationName,
        contactPhone: newPubPhone,
        contactEmail: newPubEmail,
        contactName: newPubName,
        imageUrl: newPubImageUrl
      };

      updateDoc(doc(db, "products", editingPubId), payload)
        .then(() => {
          setShowCreateModal(false);
          setIsEditing(false);
          setEditingPubId(null);
          trackEvent("Update Publication", { ...payload, id: editingPubId });
          
          // Reset states
          setNewPubTitle("");
          setNewPubDesc("");
          setNewPubPhone("");
          setNewPubEmail("");
          
          // If we had this selected, update in state
          if (selectedPub && selectedPub.id === editingPubId) {
            setSelectedPub({
              ...selectedPub,
              type: newPubType,
              title: newPubTitle,
              category: newPubCategory,
              condition: newPubCondition,
              dealType: newPubDealType,
              description: newPubDesc,
              location: {
                lat: newPubLat,
                lng: newPubLng,
                name: newPubLocationName
              },
              contactPhone: newPubPhone,
              contactEmail: newPubEmail,
              contactName: newPubName,
              imageUrl: newPubImageUrl
            });
          }
          alert("¡La publicación ha sido corregida con éxito!");
        })
        .catch(err => {
          console.error("Error updating publication:", err);
          alert("Hubo un error al guardar los cambios.");
        });
      return;
    }

    // Standard creation payload
    const payload = {
      type: newPubType === "offer" ? "ofrecimiento" : "busqueda",
      title: newPubTitle,
      category: newPubCategory,
      condition: newPubCondition,
      dealType: newPubDealType,
      description: newPubDesc,
      latitude: newPubLat,
      longitude: newPubLng,
      locationName: newPubLocationName,
      contactPhone: newPubPhone,
      contactEmail: newPubEmail,
      contactName: newPubName,
      imageUrl: newPubImageUrl,
      createdAt: Date.now(),
      views: 0
    };

    addDoc(collection(db, "products"), payload)
      .then((docRef) => {
        setShowCreateModal(false);
        trackEvent("Create Publication", { ...payload, id: docRef.id });
        
        // Track locally created publication ID
        try {
          const myPubs = JSON.parse(localStorage.getItem("my_publications_ids") || "[]");
          myPubs.push(docRef.id);
          localStorage.setItem("my_publications_ids", JSON.stringify(myPubs));
        } catch (e) {
          console.error("Error saving local publications list", e);
        }

        // Reset states
        setNewPubTitle("");
        setNewPubDesc("");
        setNewPubPhone("");
        setNewPubEmail("");
        // Move view to show the new item
        if (mapRef.current) {
          mapRef.current.setView([newPubLat, newPubLng], 12);
        }
      })
      .catch(err => console.error("Error creating publication", err));
  };

  // Submit Blog Post
  const handleCreateBlogPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlogTitle.trim() || !newBlogContent.trim() || !newBlogAuthor.trim()) {
      alert("Por favor completa todos los campos del blog");
      return;
    }

    const payload = {
      title: newBlogTitle,
      category: newBlogCategory,
      content: newBlogContent,
      authorName: newBlogAuthor,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: [],
      emoji: "✨"
    };

    addDoc(collection(db, "blog_posts"), payload)
      .then((docRef) => {
        setShowCreateBlogModal(false);
        trackEvent("Create Blog Post", { ...payload, id: docRef.id });
        
        // Reset
        setNewBlogTitle("");
        setNewBlogContent("");
        setNewBlogAuthor("");
      })
      .catch(err => console.error("Error creating blog post", err));
  };

  // Like Blog Post
  const handleLikeBlogPost = (postId: string) => {
    const postRef = doc(db, "blog_posts", postId);
    updateDoc(postRef, { likes: increment(1) })
      .then(() => {
        trackEvent("Like Blog Post", { id: postId });
      })
      .catch(err => console.error("Error liking blog post in Firestore:", err));
  };

  // Send Direct Chat Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim() || !activeChatPub) return;

    const payload = {
      senderId: userId,
      senderName: userName,
      receiverId: activeChatPub.contactName,
      message: chatInputText.trim(),
      publicationId: activeChatPub.id,
      timestamp: Date.now()
    };

    addDoc(collection(db, "messages"), payload)
      .then(() => {
        setChatInputText("");
        trackEvent("Send Internal Chat Message", { messageLength: payload.message.length, itemTitle: activeChatPub.title });

        // Simulate a neighbor response in 2 seconds to make the app feel alive!
        setTimeout(() => {
          const simulatedPayload = {
            senderId: "neighbor_" + activeChatPub.contactName,
            senderName: activeChatPub.contactName,
            receiverId: userId,
            message: `¡Hola ${userName}! Me alegro que te interese mi publicación "${activeChatPub.title}". Sí, todavía lo tengo disponible para trueque. Si te parece bien, arreglemos un punto de encuentro en la zona, o escribime directamente por WhatsApp al ${activeChatPub.contactPhone}.`,
            publicationId: activeChatPub.id,
            timestamp: Date.now()
          };

          addDoc(collection(db, "messages"), simulatedPayload)
            .catch(err => console.error("Error sending simulated response:", err));
        }, 2000);
      })
      .catch(err => console.error("Error sending message to Firestore:", err));
  };

  // Contact via WhatsApp tracking
  const handleContactWhatsApp = (pub: Publication) => {
    trackEvent("Contact WhatsApp", { id: pub.id, phone: pub.contactPhone, title: pub.title });
    const formattedPhone = pub.contactPhone.replace(/[^\d+]/g, "");
    const text = encodeURIComponent(`Hola ${pub.contactName}, vi tu publicación "${pub.title}" en Ciudad-Trueque y me interesaría coordinar un intercambio. ¿Sigue disponible?`);
    window.open(`https://wa.me/${formattedPhone}?text=${text}`, "_blank");
  };

  // Contact via Email
  const handleContactEmail = (pub: Publication) => {
    if (!pub.contactEmail) {
      alert("Este vecino no ingresó un correo electrónico de contacto. Podés escribirle por WhatsApp o por el Chat Interno.");
      return;
    }
    trackEvent("Contact Email", { id: pub.id, email: pub.contactEmail, title: pub.title });
    const subject = encodeURIComponent(`Ciudad-Trueque: Interés en tu publicación "${pub.title}"`);
    const body = encodeURIComponent(`Hola ${pub.contactName},\n\nVi tu publicación "${pub.title}" en Ciudad-Trueque y me gustaría coordinar un intercambio.\n\n¿Sigue disponible?\n\n¡Saludos!`);
    window.open(`mailto:${pub.contactEmail}?subject=${subject}&body=${body}`, "_blank");
  };

  // Process custom image file (Upload or Camera Capture)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, capture: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        const MAX_DIM = 800; // Optimal size for high quality + low payload
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.75);
          setNewPubImageUrl(compressedDataUrl);
          trackEvent("Image Uploaded/Captured", { capture, size: compressedDataUrl.length });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Initialize in-app chat for a publication
  const handleStartInAppChat = (pub: Publication) => {
    setActiveChatPub(pub);
    setActiveTab("chat");
    setSelectedPub(null);
    trackEvent("Start In-App Chat", { id: pub.id, title: pub.title });
  };

  // Toggle self-exclusion from analytics
  const handleToggleExcludeSelf = (val: boolean) => {
    setExcludeSelf(val);
    localStorage.setItem("exclude_visit", val ? "true" : "false");
    
    // Update mixpanel info
    try {
      mixpanel.register({
        "Is Owner (Excluded)": val
      });
      mixpanel.people.set({
        "Is Owner (Excluded)": val
      });
    } catch (e) {}

    trackEvent("Admin - Toggle Exclude visits", { excluded: val });
  };

  // Save customized user info
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    localStorage.setItem("trueque_userName", userName.trim());
    localStorage.setItem("trueque_mixpanel_token", customMixpanelToken.trim());
    
    // Re-initialize Mixpanel with new settings
    try {
      const activeToken = customMixpanelToken.trim() || (import.meta as any).env?.VITE_MIXPANEL_TOKEN || "mixpanel_fallback_trueque";
      mixpanel.init(activeToken, {
        track_pageview: true,
        persistence: "localStorage"
      });
      mixpanel.identify(userId);
      mixpanel.people.set({
        "$name": userName.trim(),
        "Is Owner (Excluded)": excludeSelf,
        "Mixpanel Token Type": customMixpanelToken.trim() ? "custom_ui" : "default_env"
      });
      
      mixpanel.track("Settings Updated", {
        userId,
        userName: userName.trim(),
        isOwnerExcluded: excludeSelf,
        hasCustomToken: !!customMixpanelToken.trim()
      });
    } catch (err) {
      console.warn("Error re-initializing Mixpanel:", err);
    }

    alert("¡Configuración guardada con éxito!");
    setShowProfileConfig(false);
  };

  // Search Map Coordinates roughly based on search field
  const handleMapSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapSearchText.trim()) return;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchText + ", Buenos Aires")}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          if (mapRef.current) {
            mapRef.current.setView([parseFloat(lat), parseFloat(lon)], 13);
            trackEvent("Search Map Location", { query: mapSearchText, success: true });
          }
        } else {
          alert("No se encontró la ubicación en Buenos Aires. Probá con un barrio o localidad.");
          trackEvent("Search Map Location", { query: mapSearchText, success: false });
        }
      })
      .catch(err => {
        console.error("Geocoding error", err);
      });
  };

  // Locate me using geolocation API
  const handleGeolocateUser = () => {
    if (!navigator.geolocation) {
      alert("La geolocalización no es compatible con tu navegador");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 13);
          
          // Place marker there for publication
          setNewPubLat(latitude);
          setNewPubLng(longitude);
          
          if (currentSelectMarkerRef.current) {
            currentSelectMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            const marker = L.marker([latitude, longitude], {
              icon: L.divIcon({
                className: "select-pin",
                html: `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;background:#f97316;border:2px solid white;border-radius:50%;color:white;font-weight:bold;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.3)">📍</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })
            }).addTo(mapRef.current);
            currentSelectMarkerRef.current = marker;
          }

          // reverse geocode
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.address) {
                const city = data.address.city || data.address.town || "Buenos Aires";
                const neighborhood = data.address.neighbourhood || data.address.road || city;
                setNewPubLocationName(`${neighborhood}, ${city}`);
              }
            });

          trackEvent("Geolocate User", { success: true });
        }
      },
      (err) => {
        alert("No se pudo obtener tu ubicación. Permiso denegado.");
        trackEvent("Geolocate User", { success: false, error: err.message });
      }
    );
  };

  // Active category list
  const categories = [
    { id: "all", label: "🤝 Todos", icon: "🤝" },
    { id: "Tecnología", label: "🎮 Tecnología", icon: "🎮" },
    { id: "Deportes", label: "🚲 Deportes", icon: "🚲" },
    { id: "Hogar", label: "🏠 Hogar", icon: "🏠" },
    { id: "Música", label: "🎸 Música", icon: "🎸" },
    { id: "Bebés", label: "👶 Bebés", icon: "👶" },
    { id: "Herramientas", label: "🛠️ Herramientas", icon: "🛠️" },
    { id: "Libros", label: "📚 Libros & Cultura", icon: "📚" },
    { id: "Ropa", label: "👕 Ropa & Moda", icon: "👕" }
  ];

  // Filter products based on state
  const filteredPubs = publications.filter(pub => {
    const matchCategory = selectedCategory === "all" || pub.category.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchQuery = pub.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       pub.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       pub.location.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchQuery;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* 1. TOP HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-100 transition-transform hover:scale-105 cursor-pointer">
            <span className="text-xl">🤝</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">Ciudad-Trueque</h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">CABA y Conurbano</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Real-time visits counter badge */}
          <div 
            className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold text-slate-700 transition-all cursor-help relative group" 
            title="Contador de Visitas Reales (Excluyendo tus propias visitas)"
          >
            <div className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${excludeSelf ? "bg-amber-400" : "bg-emerald-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${excludeSelf ? "bg-amber-500" : "bg-emerald-500"}`}></span>
            </div>
            <Eye className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-bold text-slate-900 text-[11px] sm:text-xs">{totalVisits}</span>
            <span className="text-[10px] text-slate-400 font-normal hidden md:inline">visitas reales</span>
            
            {excludeSelf && (
              <span className="bg-amber-100 text-amber-800 text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider scale-90">
                Excluido
              </span>
            )}

            {/* Micro tooltip explaining exclusion */}
            <div className="absolute top-full right-0 mt-2 hidden group-hover:block bg-slate-900 text-white text-[11px] p-2.5 rounded-lg shadow-xl w-64 leading-tight font-normal z-50">
              {excludeSelf 
                ? "🔒 Estás en Modo Creador. Tus visitas, clicks e interacciones NO se suman al contador ni se registran en Mixpanel público." 
                : "📈 Visitas públicas reales en tiempo real. Para excluirte, activa la opción en el menú de perfil."}
            </div>
          </div>

          <button 
            onClick={() => { setActiveTab("chat"); trackEvent("Header Clicked Tab", { tab: "chat" }); }}
            className={`p-2 sm:p-2.5 rounded-xl border transition-all relative ${
              activeTab === "chat" 
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-500 shadow-md shadow-violet-100" 
                : "bg-violet-50 border-violet-200 text-violet-600 hover:bg-violet-100 shadow-xs"
            }`}
            title="Mensajes directos"
          >
            <MessageSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce">
                {messages.length}
              </span>
            )}
          </button>

          {/* COLORFUL USER PROFILE BUTTON - ALWAYS HIGHLY VISIBLE */}
          <button 
            onClick={() => { setShowProfileConfig(!showProfileConfig); trackEvent("Header Clicked Config"); }}
            className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 transition-all shadow-sm ${
              showProfileConfig 
                ? "bg-indigo-600 border-indigo-400 text-white ring-2 ring-indigo-500/20" 
                : "bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 border-white text-white hover:scale-105 active:scale-95"
            }`}
            title={`Perfil: ${userName || "Vecino Anónimo"}`}
          >
            {userName.trim() ? (
              <span className="font-extrabold text-xs sm:text-sm uppercase tracking-tight">{userName.trim().charAt(0)}</span>
            ) : (
              <User className="w-4.5 h-4.5 stroke-[2.5]" />
            )}
          </button>

          {/* Header Publish Button - HIGHLY VISIBLE VIOLET AND BOLD ON ALL DEVICES */}
          <button 
            onClick={() => { handleOpenCreateModal(); }}
            className="flex bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 text-white px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-base font-extrabold items-center space-x-1 sm:space-x-1.5 shadow-md shadow-violet-500/30 border border-violet-400/20 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95 shrink-0"
            id="header-btn-publicar"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            <span>Publicar</span>
          </button>
        </div>
      </header>

      {/* 2. PROFILE CONFIG / ADMIN PANEL DRAWER / MODAL */}
      {showProfileConfig && (
        <div className="bg-indigo-950 text-white border-b border-indigo-900 p-6 md:p-8 animate-slideDown shadow-inner" id="admin-settings-drawer">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Drawer Title Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-indigo-900/60 pb-5">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-indigo-400 animate-spin-slow" />
                  <h3 className="font-bold text-lg tracking-tight">Panel de Control & Analíticas</h3>
                </div>
                <p className="text-xs text-indigo-200 max-w-2xl">
                  Personalizá tu experiencia, vinculá tu propio Mixpanel y gestioná la exclusión de métricas de dueño en tiempo real.
                </p>
              </div>
              <div className="bg-indigo-900/80 rounded-xl px-3.5 py-1.5 border border-indigo-700/60 text-[11px] font-mono text-indigo-300 flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                ID local: <span className="text-white font-bold">{userId}</span>
              </div>
            </div>

            {/* Bento-Style Settings Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card 1: Perfil y Vecino */}
              <div className="bg-indigo-900/40 p-5 rounded-2xl border border-indigo-800/80 flex flex-col justify-between space-y-4 shadow-sm" id="card-settings-profile">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-indigo-300">
                    <User className="w-4 h-4 text-indigo-400" />
                    <h4 className="font-bold text-sm">Nombre de Vecino/a</h4>
                  </div>
                  <p className="text-[11px] text-indigo-200">
                    Tu nombre se usará de firma cuando publiques un trueque o respondas mensajes directos.
                  </p>
                </div>
                
                <form onSubmit={handleSaveProfile} className="space-y-3">
                  <div className="relative">
                    <input 
                      type="text" 
                      value={userName} 
                      onChange={(e) => setUserName(e.target.value)}
                      className="bg-indigo-950/80 border border-indigo-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-hidden focus:border-indigo-400 w-full font-medium"
                      placeholder="Ej. Carolina Gómez"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-950"
                  >
                    Guardar Nombre
                  </button>
                </form>
              </div>

              {/* Card 2: Exclusión de Visitas */}
              <div className="bg-indigo-900/40 p-5 rounded-2xl border border-indigo-800/80 flex flex-col justify-between space-y-4 shadow-sm" id="card-settings-exclude">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-orange-400">
                    <ShieldAlert className="w-4 h-4" />
                    <h4 className="font-bold text-sm">Filtro de Creador (Exclusión)</h4>
                  </div>
                  <p className="text-[11px] text-indigo-200 leading-relaxed">
                    Excluye tus propias visitas y clicks para que el contador real de la app y los logs de Mixpanel no se inflen con tus pruebas de diseño.
                  </p>
                </div>

                <div className="bg-indigo-950/50 p-3 rounded-xl border border-indigo-800 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-100 block">Excluir mis visitas</span>
                    <span className="text-[9px] text-indigo-300 block">
                      {excludeSelf ? "🔒 Actualmente excluido" : "🟢 Actualmente registrado"}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleToggleExcludeSelf(!excludeSelf)}
                    className={`relative inline-flex h-6.5 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${excludeSelf ? "bg-orange-500" : "bg-indigo-800"}`}
                  >
                    <span className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${excludeSelf ? "translate-x-5.5" : "translate-x-0"}`} />
                  </button>
                </div>
              </div>

              {/* Card 3: Token de Mixpanel */}
              <div className="bg-indigo-900/40 p-5 rounded-2xl border border-indigo-800/80 flex flex-col justify-between space-y-4 shadow-sm" id="card-settings-mixpanel">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-indigo-300">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    <h4 className="font-bold text-sm">Tu Token de Mixpanel</h4>
                  </div>
                  <p className="text-[11px] text-indigo-200">
                    Ingresá tu Token de Proyecto de Mixpanel para trackear todas las métricas en tu propio dashboard privado.
                  </p>
                </div>

                <div className="space-y-3">
                  <input 
                    type="password" 
                    value={customMixpanelToken}
                    onChange={(e) => setCustomMixpanelToken(e.target.value)}
                    className="bg-indigo-950/80 border border-indigo-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-hidden focus:border-indigo-400 w-full font-mono text-center"
                    placeholder="Pega tu token de Mixpanel aquí"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        localStorage.setItem("trueque_mixpanel_token", customMixpanelToken.trim());
                        handleSaveProfile(e);
                      }}
                      className="flex-1 bg-pink-600 hover:bg-pink-500 text-white py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-pink-950/20"
                    >
                      Guardar Token
                    </button>
                    {customMixpanelToken.trim() && (
                      <button 
                        onClick={() => {
                          setCustomMixpanelToken("");
                          localStorage.removeItem("trueque_mixpanel_token");
                          alert("Token personalizado removido. Usando Mixpanel por defecto.");
                          window.location.reload();
                        }}
                        className="bg-indigo-800 hover:bg-red-900 text-indigo-200 hover:text-white px-2.5 rounded-xl text-xs font-bold transition-all"
                        title="Borrar token personalizado"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* REAL-TIME LOCAL COMMUNITY METRICS & MIXPANEL FREE GUIDE */}
            {(() => {
              const totalOffers = publications.filter(p => p.type === "offer").length;
              const totalSearches = publications.filter(p => p.type === "search").length;
              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2" id="metrics-local-dashboard">
                  
                  {/* Box A: Local Community Real-time Dashboard (7 cols) */}
                  <div className="lg:col-span-7 bg-gradient-to-br from-indigo-900/40 via-purple-950/40 to-slate-950/50 p-6 rounded-2xl border border-indigo-800/80 space-y-4 shadow-md">
                    <div className="flex items-center justify-between border-b border-indigo-900/60 pb-3">
                      <div className="flex items-center space-x-2 text-indigo-300">
                        <Eye className="w-4 h-4 text-indigo-400" />
                        <h4 className="font-bold text-xs uppercase tracking-wider">Métricas Comunitarias (Tiempo Real)</h4>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-extrabold bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5 animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>En Vivo</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {/* Visitas */}
                      <div className="bg-indigo-950/40 border border-indigo-900/50 p-3 rounded-xl text-center space-y-0.5">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-300 block">Visitas Reales</span>
                        <span className="text-xl font-black text-white font-mono">{totalVisits}</span>
                        <span className="text-[8px] text-slate-400 block font-normal">Excluye dueño</span>
                      </div>

                      {/* Publicaciones */}
                      <div className="bg-indigo-950/40 border border-indigo-900/50 p-3 rounded-xl text-center space-y-0.5">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-300 block">Trueques Activos</span>
                        <span className="text-xl font-black text-violet-400 font-mono">{publications.length}</span>
                        <span className="text-[8px] text-slate-400 block font-normal">{totalOffers} ofr / {totalSearches} bús</span>
                      </div>

                      {/* Mensajes */}
                      <div className="bg-indigo-950/40 border border-indigo-900/50 p-3 rounded-xl text-center space-y-0.5">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-300 block">Mensajes En-App</span>
                        <span className="text-xl font-black text-pink-400 font-mono">{messages.length}</span>
                        <span className="text-[8px] text-slate-400 block font-normal">Chats directos</span>
                      </div>

                      {/* Blog posts */}
                      <div className="bg-indigo-950/40 border border-indigo-900/50 p-3 rounded-xl text-center space-y-0.5">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-300 block">Entradas Blog</span>
                        <span className="text-xl font-black text-amber-400 font-mono">{blogPosts.length}</span>
                        <span className="text-[8px] text-slate-400 block font-normal">Saber popular</span>
                      </div>
                    </div>

                    {/* Distribution slider bar */}
                    <div className="bg-indigo-950/60 p-3 rounded-xl border border-indigo-900/40 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-indigo-200">
                        <span className="font-bold">Distribución de Publicaciones:</span>
                        <span className="font-mono">{publications.length > 0 ? Math.round((totalOffers/publications.length)*100) : 50}% Ofrecimientos / {publications.length > 0 ? Math.round((totalSearches/publications.length)*100) : 50}% Búsquedas</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
                        <div 
                          className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full transition-all duration-500" 
                          style={{ width: `${publications.length > 0 ? (totalOffers/publications.length)*100 : 50}%` }}
                        />
                        <div 
                          className="bg-gradient-to-r from-pink-500 to-rose-500 h-full transition-all duration-500" 
                          style={{ width: `${publications.length > 0 ? (totalSearches/publications.length)*100 : 50}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-indigo-300/80">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"></span> Ofrecimientos ({totalOffers})</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-pink-500 inline-block"></span> Búsquedas ({totalSearches})</span>
                      </div>
                    </div>
                  </div>

                  {/* Box B: How to get Mixpanel for Free (5 cols) */}
                  <div className="lg:col-span-5 bg-gradient-to-br from-indigo-900/20 via-purple-950/20 to-slate-950/30 p-6 rounded-2xl border border-indigo-800/80 space-y-3.5 shadow-md flex flex-col justify-between">
                    <div className="space-y-1 border-b border-indigo-900/40 pb-2.5">
                      <div className="flex items-center space-x-2 text-indigo-300">
                        <Sparkles className="w-4 h-4 text-pink-400" />
                        <h4 className="font-bold text-xs uppercase tracking-wider">Mixpanel 100% Gratuito (Plan Gratis)</h4>
                      </div>
                      <p className="text-[11px] text-indigo-200 leading-relaxed">
                        Mixpanel tiene un plan 100% gratuito de por vida, ideal para Ciudad-Trueque (100.000 eventos/mes sin tarjeta). Así podés crear tu propia cuenta sin costo:
                      </p>
                    </div>

                    <div className="space-y-2.5 text-[11px] text-indigo-200 leading-normal">
                      <div className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-800 text-white font-mono font-bold text-[9px] shrink-0 mt-0.5">1</span>
                        <span>Registrate en <a href="https://mixpanel.com" target="_blank" rel="noopener noreferrer" className="text-pink-400 underline hover:text-pink-300 font-bold">mixpanel.com</a> (es gratis).</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-800 text-white font-mono font-bold text-[9px] shrink-0 mt-0.5">2</span>
                        <span>Creá tu proyecto. Buscá arriba a la derecha: <strong>Settings (⚙️) &gt; Project Settings</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-800 text-white font-mono font-bold text-[9px] shrink-0 mt-0.5">3</span>
                        <span>Copia el <strong>Project Token</strong> y pegalo arriba. ¡Listo! Verás estadísticas detalladas en tu panel.</span>
                      </div>
                    </div>

                    <div className="bg-indigo-950/50 p-2.5 rounded-xl border border-indigo-900/40 text-[10px] text-indigo-300/90 text-center leading-tight">
                      💡 <strong>¿No tenés cuenta todavía?</strong> No te preocupes. La app ya viene con un token público de demostración para que veas tus eventos en tiempo real abajo.
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* Live Mixpanel Event Stream Log (Debugger) */}
            <div className="bg-indigo-950 border border-indigo-900 rounded-2xl p-4.5" id="mixpanel-live-stream">
              <div className="flex items-center justify-between border-b border-indigo-900/60 pb-3 mb-3">
                <div className="flex items-center space-x-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <h4 className="text-xs font-bold tracking-wider uppercase text-indigo-300">Live Mixpanel Tracker (Consola de Eventos)</h4>
                </div>
                <span className="text-[10px] text-indigo-400 font-medium">Mostrando últimos 8 eventos</span>
              </div>

              {liveEvents.length === 0 ? (
                <div className="text-center py-4 text-xs text-indigo-400 italic">
                  Navegá por la web o hacé clicks para generar logs de eventos de Mixpanel...
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {liveEvents.map((ev) => (
                    <div 
                      key={ev.id} 
                      className="bg-indigo-900/30 border border-indigo-900/60 p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between text-[11px] gap-2 hover:bg-indigo-900/50 transition-colors"
                    >
                      <div className="flex items-start sm:items-center space-x-2">
                        <span className="text-[9px] font-mono text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded-md">{ev.time}</span>
                        <strong className="text-indigo-200 font-mono text-xs">{ev.name}</strong>
                      </div>
                      <div className="font-mono text-[10px] text-slate-300/90 truncate max-w-full sm:max-w-md lg:max-w-xl" title={JSON.stringify(ev.props)}>
                        {JSON.stringify(ev.props)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 3. HERO BANNER AREA */}
      <section 
        className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-950 to-slate-950 p-6 md:p-10 text-white shadow-xl shadow-indigo-200/50 my-6 mx-4 md:mx-auto max-w-7xl border border-indigo-500/20 rounded-3xl" 
        id="hero-banner"
      >
        <div className="absolute -bottom-16 -right-16 w-80 h-80 bg-amber-500/25 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -top-16 -left-16 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        
        {/* Floating animated items using motion */}
        <motion.div 
          animate={{ y: [0, -20, 0], x: [0, 15, 0], rotate: [0, 15, -15, 0] }} 
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} 
          className="absolute top-6 right-[20%] text-4xl pointer-events-none drop-shadow-xl filter select-none hidden md:block"
        >
          🎸
        </motion.div>
        <motion.div 
          animate={{ y: [0, 25, 0], x: [0, -20, 0], rotate: [0, -12, 12, 0] }} 
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }} 
          className="absolute bottom-6 left-[12%] text-4xl pointer-events-none drop-shadow-xl filter select-none hidden md:block"
        >
          🚲
        </motion.div>
        <motion.div 
          animate={{ scale: [1, 1.25, 1], rotate: [0, 360] }} 
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }} 
          className="absolute top-1/4 left-[35%] text-3xl pointer-events-none drop-shadow-xl filter select-none opacity-90 hidden md:block"
        >
          ✨
        </motion.div>
        <motion.div 
          animate={{ y: [0, -28, 0], x: [0, 20, 0], rotate: [0, 360] }} 
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 3 }} 
          className="absolute bottom-10 right-[38%] text-4xl pointer-events-none drop-shadow-xl filter select-none hidden md:block"
        >
          🌱
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          <div className="lg:col-span-8 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-amber-500 border border-orange-400 px-4.5 py-2 rounded-full text-xs font-black text-white tracking-wider uppercase shadow-[0_0_20px_rgba(249,115,22,0.4)] animate-bounce select-none">
              <Sparkles className="w-4 h-4 text-yellow-300 shrink-0 animate-pulse" />
              <span className="tracking-widest">¡Te lo cambio o te lo vendo! 🍊🔥</span>
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight bg-gradient-to-r from-white via-indigo-100 to-amber-200 bg-clip-text text-transparent">
              Intercambia, Compra o Vende <br /> en CABA y Conurbano 🤝🎉
            </h2>

            <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
              La red comunitaria de trueque más activa. Dale una segunda vida a lo que no usas, encuentra tesoros en tu zona directo en el mapa, y haz tratos rápidos por chat integrado o WhatsApp.
            </p>

            <div className="bg-slate-900/60 border border-white/10 backdrop-blur-md p-4.5 rounded-2xl max-w-xl space-y-2.5 shadow-inner">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300 flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 text-indigo-400 animate-spin [animation-duration:12s]" />
                Qué se está intercambiando ahora:
              </span>
              <div className="h-20 flex items-center relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTradeIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center gap-3 w-full"
                  >
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-2.5 rounded-xl flex-1 min-w-0 shadow-lg">
                      <span className="text-3xl shrink-0 filter drop-shadow-md">{tradesCarousel[activeTradeIndex].haveIcon}</span>
                      <div className="text-xs font-bold text-slate-100 truncate">
                        <span className="block text-[9px] text-slate-400 uppercase tracking-tight font-black">Ofrecido:</span>
                        <span className="text-sm">{tradesCarousel[activeTradeIndex].have}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center shrink-0">
                      <motion.div
                        animate={{ scale: [1, 1.25, 1] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        className="w-12 h-12 rounded-full bg-gradient-to-tr from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shrink-0 border-2 border-white"
                      >
                        <span className="text-2xl filter drop-shadow">🤝</span>
                      </motion.div>
                    </div>

                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-2.5 rounded-xl flex-1 min-w-0 shadow-lg">
                      <span className="text-3xl shrink-0 filter drop-shadow-md">{tradesCarousel[activeTradeIndex].wantIcon}</span>
                      <div className="text-xs font-bold text-slate-100 truncate">
                        <span className="block text-[9px] text-slate-400 uppercase tracking-tight font-black">Buscado:</span>
                        <span className="text-sm">{tradesCarousel[activeTradeIndex].want}</span>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right graphics column */}
          <div className="hidden lg:col-span-4 lg:flex justify-center relative">
            <div className="relative w-full h-full flex items-center justify-center min-h-[260px]">
              <div className="absolute w-52 h-52 bg-gradient-to-tr from-yellow-300 via-pink-500 to-indigo-500 rounded-full blur-2xl opacity-50 animate-pulse pointer-events-none" />
              
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 18, ease: "linear" }}
                className="w-60 h-60 rounded-full border-4 border-dashed border-white/40 flex items-center justify-center relative"
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 border-2 border-white flex items-center justify-center text-2xl shadow-xl hover:scale-110 transition-transform">🚲</div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 border-2 border-white flex items-center justify-center text-2xl shadow-xl hover:scale-110 transition-transform">🎸</div>
                <div className="absolute left-[-24px] top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-white flex items-center justify-center text-2xl shadow-xl hover:scale-110 transition-transform">🎮</div>
                <div className="absolute right-[-24px] top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 border-2 border-white flex items-center justify-center text-2xl shadow-xl hover:scale-110 transition-transform">🌱</div>
              </motion.div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: [1, 1.05, 1], opacity: 1 }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="absolute w-48 bg-slate-950 border-2 border-violet-500 p-5 rounded-2xl shadow-2xl text-center flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 text-white flex items-center justify-center shadow-lg border-2 border-white animate-pulse">
                  <span className="text-3xl">🤝</span>
                </div>
                <span className="text-sm font-black text-white tracking-wide uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] text-yellow-300">Trueque Comunitario</span>
                <span className="text-[10px] font-bold text-slate-200">¡Conecta, cambia y ahorra! 🌟</span>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MAIN NAVIGATION TABS */}
      <section className="bg-white border-b border-slate-200/80 sticky top-[65px] z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex gap-3">
          <button 
            onClick={() => { setActiveTab("market"); trackEvent("Tab Switched", { tab: "market" }); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all ${activeTab === "market" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-indigo-50/75 border border-indigo-150 text-indigo-700 hover:bg-indigo-100/70"}`}
          >
            <span className="text-base">📦</span>
            <span>Muro de Trueques</span>
          </button>

          <button 
            onClick={() => { setActiveTab("blog"); trackEvent("Tab Switched", { tab: "blog" }); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-extrabold text-sm transition-all relative overflow-hidden ${
              activeTab === "blog" 
                ? "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-md shadow-violet-200 border-violet-500" 
                : "bg-violet-50 border-2 border-violet-200 text-violet-700 hover:bg-violet-100 shadow-xs"
            }`}
            title="Blog de la Comunidad - Consejos y relatos"
          >
            {/* Soft pink ping indicator to guarantee it captures attention */}
            <span className="absolute top-1 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
            </span>
            <span className="text-lg">📝</span>
            <span>Blog de la Comunidad</span>
          </button>
        </div>
      </section>

      {/* 5. GEOGRAPHIC EXPLORER / MAP AREA */}
      <section className="bg-white border-b border-slate-200 p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xl">🗺️</span>
              <div>
                <h3 className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg">EXPLORADOR GEOGRÁFICO</h3>
                <p className="text-xs text-slate-500">Haz clic en el mapa para ubicar productos o seleccionar coordenadas</p>
              </div>
            </div>

            {/* Geocoding Map search */}
            <form onSubmit={handleMapSearch} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Buscar localidad (ej: Caballito, San Isidro...)" 
                value={mapSearchText}
                onChange={(e) => setMapSearchText(e.target.value)}
                className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-1.5 text-xs focus:outline-hidden focus:border-indigo-500 w-full sm:w-60"
              />
              <button 
                type="submit"
                className="bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-4 py-1.5 text-xs font-bold flex items-center space-x-1"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Buscar</span>
              </button>
              <button 
                type="button"
                onClick={handleGeolocateUser}
                className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600"
                title="Mi ubicación actual"
              >
                <Navigation className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Leaflet Map container */}
          <div className="mx-6 sm:mx-0 relative border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div 
              ref={mapContainerRef} 
              className="w-full h-[250px] sm:h-[400px] z-10"
            />
            {/* Float Floating Action Button on the Map */}
            <button 
              onClick={() => { handleOpenCreateModal(); }}
              className="absolute bottom-4 right-4 z-20 bg-indigo-600 hover:bg-indigo-700 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110"
              title="Publicar trueque en esta ubicación"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>
      </section>

      {/* 6. TAB CONTENTS */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6" id="muro-de-trueques">
        
        {/* ======================================= */}
        {/* TAB 1: MARKET - MURO DE TRUEQUES       */}
        {/* ======================================= */}
        {activeTab === "market" && (
          <div className="space-y-6">
            
            {/* Category selection horizontal bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-slate-800 text-lg uppercase tracking-wider">📦 Trueques Disponibles</span>
                <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs px-2 py-0.5 rounded-full">
                  {filteredPubs.length}
                </span>
              </div>

              {/* Text Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text" 
                  placeholder="Buscar productos por palabra clave..." 
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    trackEvent("Typed Search Query", { query: e.target.value });
                  }}
                  className="border border-slate-200 rounded-xl bg-white pl-9 pr-4 py-2 text-xs focus:outline-hidden focus:border-indigo-500 w-full"
                />
              </div>
            </div>

            {/* Category Pill Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
              {categories.map((cat) => (
                <button 
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    trackEvent("Filtered Category Pill", { category: cat.id });
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 ${selectedCategory === cat.id ? "bg-indigo-600 border-indigo-500 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Product Cards Grid */}
            {filteredPubs.length === 0 ? (
              <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center max-w-md mx-auto space-y-3">
                <span className="text-4xl">🔍</span>
                <h4 className="font-bold text-slate-800 text-base">No encontramos publicaciones</h4>
                <p className="text-slate-500 text-xs">
                  Prueba seleccionando otra categoría o borrando tu filtro de búsqueda actual.
                </p>
                <button 
                  onClick={() => { setSelectedCategory("all"); setSearchQuery(""); }}
                  className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2 rounded-xl font-bold"
                >
                  Limpiar Filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPubs.map((pub) => (
                  <article 
                    key={pub.id}
                    className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group border-b-3 border-b-slate-100 hover:border-b-indigo-500"
                  >
                    {/* Card image header */}
                    <div className="relative h-48 bg-slate-100 overflow-hidden shrink-0">
                      <img 
                        src={pub.imageUrl} 
                        alt={pub.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Publication Type Badge */}
                      <span className={`absolute top-3 left-3 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border shadow-sm ${pub.type === "offer" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
                        {pub.type === "offer" ? "🟢 Ofrecido" : "🔵 Buscado"}
                      </span>

                      {/* Views Badge */}
                      <div className="absolute bottom-3 right-3 bg-slate-900/60 backdrop-blur-xs text-white px-2 py-1 rounded-md text-[10px] font-semibold flex items-center space-x-1">
                        <Eye className="w-3 h-3 text-slate-200" />
                        <span>{pub.views || 0} vistas</span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{pub.category}</span>
                        <h4 
                          onClick={() => handleViewPublication(pub)}
                          className="font-black text-slate-900 text-base leading-snug hover:text-indigo-600 transition-colors cursor-pointer limit-2-lines"
                        >
                          {pub.title}
                        </h4>
                        
                        <div className="flex items-center space-x-1 text-slate-500 text-xs">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{pub.location.name}</span>
                        </div>

                        <p className="text-slate-600 text-xs leading-relaxed limit-3-lines">
                          {pub.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="text-left">
                          <p className="text-[9px] text-slate-400 font-bold uppercase leading-none">Contacto</p>
                          <p className="text-xs font-bold text-slate-800 truncate max-w-28">{pub.contactName}</p>
                        </div>

                        {/* Detail Trigger */}
                        <button 
                          onClick={() => handleViewPublication(pub)}
                          className="text-xs bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold px-3 py-1.5 rounded-lg shrink-0 transition-colors"
                        >
                          Ver Más
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================= */}
        {/* TAB 2: BLOG - BLOG DE LA COMUNIDAD     */}
        {/* ======================================= */}
        {activeTab === "blog" && (
          <div className="space-y-6 max-w-4xl mx-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <span className="text-xl">📝</span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg uppercase tracking-tight">Blog de la Comunidad</h3>
                  <p className="text-xs text-slate-500">Historias de trueques, convocatorias a ferias vecinales y consejos prácticos</p>
                </div>
              </div>

              <button 
                onClick={() => { setShowCreateBlogModal(true); trackEvent("Blog Clicked Crear Entrada"); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center space-x-1.5 shadow-md shadow-indigo-100 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Escribir Entrada</span>
              </button>
            </div>

            {/* Blog Post List */}
            {blogPosts.length === 0 ? (
              <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center max-w-md mx-auto space-y-3">
                <span className="text-4xl">📝</span>
                <h4 className="font-bold text-slate-800 text-base">No hay entradas publicadas aún</h4>
                <p className="text-slate-500 text-xs">
                  Sé el primero en compartir tu experiencia en Ciudad-Trueque con el resto del barrio.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {blogPosts.map((post) => (
                  <article key={post.id} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs border-l-4 border-l-indigo-600 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                        {post.category}
                      </span>
                      <div className="flex items-center space-x-1 text-slate-400 text-[11px] font-semibold">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(post.timestamp).toLocaleDateString("es-AR")}</span>
                      </div>
                    </div>

                    <h4 className="font-black text-slate-900 text-xl tracking-tight leading-snug">
                      {post.title}
                    </h4>

                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                      {post.content}
                    </p>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-slate-400">Escrito por: </span>
                        <strong className="text-slate-700">{post.author}</strong>
                      </div>

                      <button 
                        onClick={() => handleLikeBlogPost(post.id)}
                        className="flex items-center space-x-1.5 text-xs bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 font-bold px-3.5 py-1.5 rounded-xl transition-colors"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        <span>{post.likes || 0} Me Gusta</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================= */}
        {/* TAB 3: CHAT - MENSAJES INTEGRADOS      */}
        {/* ======================================= */}
        {activeTab === "chat" && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-md max-w-4xl mx-auto h-[500px] flex">
            
            {/* Conversation sidebar list */}
            <div className="w-1/3 border-r border-slate-100 bg-slate-50/50 p-4 flex flex-col">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-3 mb-3 shrink-0">
                💬 Conversaciones
              </h4>
              <div className="flex-1 overflow-y-auto space-y-2">
                {publications.map((p) => {
                  const hasConversation = messages.some(m => m.publicationId === p.id);
                  if (!hasConversation && activeChatPub?.id !== p.id) return null;

                  return (
                    <div 
                      key={p.id}
                      onClick={() => {
                        setActiveChatPub(p);
                        trackEvent("Chat Switched Conversation", { id: p.id, title: p.title });
                      }}
                      className={`p-3 rounded-xl cursor-pointer border transition-all ${activeChatPub?.id === p.id ? "bg-white border-indigo-200 shadow-sm" : "border-transparent hover:bg-slate-150"}`}
                    >
                      <div className="flex items-center space-x-2">
                        <img 
                          src={p.imageUrl} 
                          alt="" 
                          className="w-8 h-8 rounded-lg object-cover shrink-0" 
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-slate-800 truncate">{p.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">Socio: {p.contactName}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && !activeChatPub && (
                  <p className="text-slate-400 text-xs text-center py-12">No tienes chats activos.</p>
                )}
              </div>
            </div>

            {/* Main Chat Conversation area */}
            <div className="flex-1 flex flex-col h-full bg-white">
              {activeChatPub ? (
                <>
                  {/* Chat Item Header */}
                  <div className="border-b border-slate-100 p-4 flex items-center justify-between shrink-0 bg-slate-50/30">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={activeChatPub.imageUrl} 
                        alt="" 
                        className="w-10 h-10 rounded-xl object-cover shrink-0" 
                      />
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-none">{activeChatPub.title}</h4>
                        <p className="text-xs text-slate-500 mt-1">Con: <span className="font-semibold text-slate-700">{activeChatPub.contactName}</span></p>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleContactWhatsApp(activeChatPub)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>Ir a WhatsApp</span>
                      </button>
                      <button 
                        onClick={() => setActiveChatPub(null)}
                        className="text-slate-400 hover:text-slate-600 text-xs p-1"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>

                  {/* Messages Stream */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/20">
                    {messages
                      .filter(m => m.publicationId === activeChatPub.id)
                      .map((msg) => {
                        const isMe = msg.senderId === userId;
                        return (
                          <div 
                            key={msg.id} 
                            className={`flex flex-col max-w-[80%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}
                          >
                            <span className="text-[9px] text-slate-400 font-semibold mb-0.5 px-1">{msg.senderName}</span>
                            <div className={`p-3 rounded-2xl text-xs leading-relaxed ${isMe ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"}`}>
                              {msg.message}
                            </div>
                            <span className="text-[8px] text-slate-400 mt-0.5 px-1">
                              {new Date(msg.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        );
                      })}
                  </div>

                  {/* Input Form */}
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 flex gap-2 shrink-0 bg-white">
                    <input 
                      type="text" 
                      placeholder="Escribe un mensaje privado para coordinar el trueque..."
                      value={chatInputText}
                      onChange={(e) => setChatInputText(e.target.value)}
                      className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50"
                    />
                    <button 
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl shrink-0 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-3">
                  <span className="text-4xl">💬</span>
                  <h4 className="font-bold text-slate-800 text-base">Conversaciones Privadas</h4>
                  <p className="text-slate-500 text-xs max-w-sm">
                    Selecciona una conversación del menú lateral, o ve al Muro de Trueques y dale clic a "Iniciar Chat" en el producto que te interese para arreglar un canje.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* ======================================= */}
      {/* 7. MODAL: DETALLES DE PUBLICACION      */}
      {/* ======================================= */}
      {selectedPub && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl overflow-hidden max-w-2xl w-full border border-slate-100 shadow-2xl flex flex-col md:flex-row h-auto md:h-[500px]">
            
            {/* Image banner side */}
            <div className="md:w-1/2 relative bg-slate-100 h-64 md:h-auto shrink-0">
              <img 
                src={selectedPub.imageUrl} 
                alt={selectedPub.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <span className={`absolute top-4 left-4 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full border shadow-xs ${selectedPub.type === "offer" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
                {selectedPub.type === "offer" ? "🟢 Ofrecido" : "🔵 Buscado"}
              </span>
            </div>

            {/* Text description side */}
            <div className="p-6 md:w-1/2 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">{selectedPub.category}</span>
                  <button 
                    onClick={() => setSelectedPub(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                  >
                    ✕
                  </button>
                </div>

                <h3 className="text-xl font-black text-slate-900 leading-snug tracking-tight">
                  {selectedPub.title}
                </h3>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-b border-slate-100 py-3 text-[11px] font-semibold text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold leading-none mb-1">Estado</span>
                    <span className="bg-slate-50 border border-slate-100 rounded-md px-2 py-1 inline-block">{selectedPub.condition}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold leading-none mb-1">Trato</span>
                    <span className="bg-slate-50 border border-slate-100 rounded-md px-2 py-1 inline-block">{selectedPub.dealType}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 text-slate-600 text-xs">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="font-bold">{selectedPub.location.name}</span>
                </div>

                <p className="text-slate-600 text-xs leading-relaxed max-h-40 overflow-y-auto">
                  {selectedPub.description}
                </p>
              </div>

              {/* Actions side */}
              <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase leading-none">Vecino/a</p>
                    <p className="text-xs font-bold text-slate-800">{selectedPub.contactName}</p>
                  </div>
                  <div className="text-right text-[10px] text-slate-400">
                    <span>{selectedPub.views || 0} visitas del post</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    onClick={() => handleContactWhatsApp(selectedPub)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1 shadow-md shadow-emerald-950/20"
                  >
                    <span>🟢 WhatsApp</span>
                  </button>

                  <button 
                    onClick={() => handleContactEmail(selectedPub)}
                    className={`font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1 shadow-md transition-all ${
                      selectedPub.contactEmail 
                        ? "bg-sky-600 hover:bg-sky-700 text-white shadow-sky-500/10" 
                        : "bg-slate-100 text-slate-400 border border-slate-200"
                    }`}
                    title={selectedPub.contactEmail ? `Enviar correo a ${selectedPub.contactEmail}` : "Sin correo electrónico configurado"}
                  >
                    <span>📧 Correo</span>
                  </button>
                </div>

                <button 
                  onClick={() => handleStartInAppChat(selectedPub)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1 shadow-md shadow-indigo-100 mt-2"
                >
                  <span>💬 Chat Interno de la Comunidad</span>
                </button>

                {/* Edit Button option */}
                {(() => {
                  let isOwner = false;
                  try {
                    const myPubs = JSON.parse(localStorage.getItem("my_publications_ids") || "[]");
                    isOwner = myPubs.includes(selectedPub.id) || 
                      (userName && selectedPub.contactName.trim().toLowerCase() === userName.trim().toLowerCase());
                  } catch (e) {}

                  return (
                    <button 
                      onClick={() => handleEditPublication(selectedPub)}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 border transition-colors mt-2 ${
                        isOwner 
                          ? "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100" 
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                      title={isOwner ? "Eres el autor, puedes corregir este anuncio" : "Corregir o editar los detalles de este anuncio"}
                    >
                      <span>✏️ {isOwner ? "Corregir Mi Publicación" : "Corregir / Editar Anuncio"}</span>
                    </button>
                  );
                })()}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ======================================= */}
      {/* 8. MODAL: CREAR PUBLICACION (FORM)     */}
      {/* ======================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl overflow-hidden max-w-xl w-full border border-slate-150 shadow-2xl flex flex-col h-[90vh]">
            
            {/* Modal Header */}
            <div className={`${isEditing ? "bg-violet-600" : "bg-indigo-600"} text-white p-5 shrink-0 flex items-center justify-between`}>
              <div>
                <h3 className="font-black text-lg">{isEditing ? "Corregir Publicación" : "Crear Publicación"}</h3>
                <p className="text-xs text-indigo-100">{isEditing ? "Modifica los detalles de tu anuncio de trueque" : "Ofrece un trueque o busca lo que necesitas en la comunidad"}</p>
              </div>
              <button 
                onClick={handleCloseCreateModal}
                className="text-white hover:text-indigo-200 font-extrabold text-xl p-2"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleCreatePublication} className="flex-1 overflow-y-auto p-6 space-y-5 text-left">
              
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">1. ¿Qué deseas hacer? *</label>
                <div className="flex gap-4">
                  <label className="flex-1 flex items-center justify-center gap-2 border border-slate-200 rounded-xl p-3 cursor-pointer hover:bg-slate-50">
                    <input 
                      type="radio" 
                      name="pubType" 
                      checked={newPubType === "offer"}
                      onChange={() => setNewPubType("offer")}
                      className="text-indigo-600"
                    />
                    <span className="text-xs font-bold text-slate-800">🟢 Ofrecer Producto</span>
                  </label>

                  <label className="flex-1 flex items-center justify-center gap-2 border border-slate-200 rounded-xl p-3 cursor-pointer hover:bg-slate-50">
                    <input 
                      type="radio" 
                      name="pubType" 
                      checked={newPubType === "search"}
                      onChange={() => setNewPubType("search")}
                      className="text-indigo-600"
                    />
                    <span className="text-xs font-bold text-slate-800">🔵 Plantear Búsqueda</span>
                  </label>
                </div>
              </div>

              {/* Title input */}
              <div className="space-y-1">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">Título de la publicación *</label>
                <input 
                  type="text" 
                  placeholder="Ej: Bicicleta de montaña, PlayStation 4, Busco..."
                  required
                  value={newPubTitle}
                  onChange={(e) => setNewPubTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50"
                  maxLength={50}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category Dropdown */}
                <div className="space-y-1">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">Categoría</label>
                  <select 
                    value={newPubCategory}
                    onChange={(e) => setNewPubCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50"
                  >
                    <option value="Tecnología & Videojuegos">🎮 Tecnología</option>
                    <option value="Deportes & Aire Libre">🚲 Deportes</option>
                    <option value="Hogar & Muebles">🏠 Hogar</option>
                    <option value="Música & Instrumentos">🎸 Música</option>
                    <option value="Bebés & Niños">👶 Bebés</option>
                    <option value="Herramientas">🛠️ Herramientas</option>
                    <option value="Libros & Cultura">📚 Libros</option>
                    <option value="Ropa & Moda">👕 Ropa</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                {/* Article Condition Dropdown */}
                <div className="space-y-1">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">Estado del artículo</label>
                  <select 
                    value={newPubCondition}
                    onChange={(e) => setNewPubCondition(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50"
                  >
                    <option value="Nuevo">Nuevo / Impecable</option>
                    <option value="Usado / Como nuevo">Usado / Como nuevo</option>
                    <option value="Usado / Muy bueno">Usado / Muy bueno</option>
                    <option value="Usado / Buen estado">Usado / Buen estado</option>
                    <option value="Usado / Con detalles">Usado / Con detalles</option>
                    <option value="No aplica">No aplica / Servicios</option>
                  </select>
                </div>
              </div>

              {/* Deal Type Dropdown */}
              <div className="space-y-1">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">Modalidad de trato</label>
                <select 
                  value={newPubDealType}
                  onChange={(e) => setNewPubDealType(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50"
                >
                  <option value="Solo Trueque (Intercambio directo)">Solo Trueque (Intercambio directo)</option>
                  <option value="Trueque o Venta">Trueque o Venta</option>
                  <option value="Trueque por Consumibles">Trueque por alimentos/consumibles</option>
                  <option value="Servicio por Producto">Ofrezco servicio por producto</option>
                  <option value="Gratis / Donación">Gratis / Donación para el barrio</option>
                </select>
              </div>

              {/* Detailed Description */}
              <div className="space-y-1">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">Descripción detallada *</label>
                <textarea 
                  placeholder="Cuéntanos qué ofreces o buscas, sus detalles y qué te interesaría recibir a cambio..."
                  required
                  rows={4}
                  value={newPubDesc}
                  onChange={(e) => setNewPubDesc(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50"
                  maxLength={400}
                />
              </div>

              {/* Image capture & Gallery uploading */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">Foto del producto / servicio</label>
                
                {/* Visual Preview when custom uploaded/captured */}
                {newPubImageUrl && newPubImageUrl.startsWith("data:image") ? (
                  <div className="relative rounded-2xl overflow-hidden h-40 border-2 border-indigo-500 shadow-md group">
                    <img src={newPubImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-black bg-slate-900/80 px-3 py-1.5 rounded-full">✓ Foto cargada con éxito</span>
                      <button 
                        type="button"
                        onClick={() => {
                          setNewPubImageUrl(PRESET_IMAGES[0].url);
                          trackEvent("Form Removed Custom Image");
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-md transition-transform active:scale-95"
                      >
                        🗑️ Eliminar y usar predeterminado
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Direct Upload and Camera buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Gallery Input Wrapper */}
                  <label className="flex items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-3 cursor-pointer hover:bg-indigo-50/20 transition-all text-slate-600 hover:text-indigo-600">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleImageFileChange(e, false)}
                      className="hidden"
                    />
                    <span className="text-base">📁</span>
                    <span className="text-[11px] font-extrabold">Elegir de Galería</span>
                  </label>

                  {/* Camera Input Wrapper */}
                  <label className="flex items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 hover:border-violet-400 rounded-xl p-3 cursor-pointer hover:bg-violet-50/20 transition-all text-slate-600 hover:text-violet-600">
                    <input 
                      type="file" 
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleImageFileChange(e, true)}
                      className="hidden"
                    />
                    <span className="text-base">📸</span>
                    <span className="text-[11px] font-extrabold">Tomar Foto (Cámara)</span>
                  </label>
                </div>

                {/* Toggle preset or custom link section */}
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-2.5 space-y-2 mt-2">
                  <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">O usa un diseño predefinido / link de internet:</span>
                  
                  <div className="grid grid-cols-3 gap-2 h-16 overflow-y-auto pr-1">
                    {PRESET_IMAGES.map((img) => (
                      <div 
                        key={img.name}
                        onClick={() => { setNewPubImageUrl(img.url); trackEvent("Form Clicked Preset Image", { preset: img.name }); }}
                        className={`relative rounded-lg overflow-hidden cursor-pointer h-12 border-2 transition-all ${newPubImageUrl === img.url ? "border-indigo-500 scale-95" : "border-transparent opacity-65 hover:opacity-100"}`}
                      >
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-end p-0.5">
                          <span className="text-[6.5px] text-white font-black truncate w-full">{img.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-0.5 pt-1">
                    <input 
                      type="url" 
                      value={newPubImageUrl.startsWith("data:image") ? "" : newPubImageUrl}
                      onChange={(e) => setNewPubImageUrl(e.target.value)}
                      placeholder="Ingresa link de imagen (https://...)"
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] focus:outline-hidden focus:border-indigo-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Location display & Geolocation picker */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                <h4 className="text-xs font-extrabold text-amber-900 flex items-center space-x-1">
                  <span>📍</span>
                  <span>Ubicación Geográfica en el mapa:</span>
                </h4>
                <p className="text-[10px] text-amber-700">
                  Hacé clic en cualquier lugar del mapa de fondo (o click en el botón de ubicación) para ubicar tu trueque. Se completará automáticamente.
                </p>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    required
                    value={newPubLocationName}
                    onChange={(e) => setNewPubLocationName(e.target.value)}
                    placeholder="Barrio, localidad (Ej: Palermo, San Isidro)"
                    className="border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-xs focus:outline-hidden focus:border-indigo-500 w-full"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      setIsSelectingLocationOnMap(true);
                      alert("Pulsá en el mapa principal que está detrás para marcar tu ubicación. ¡Se actualizarán las coordenadas!");
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shrink-0"
                  >
                    Marcar en mapa
                  </button>
                </div>
                <div className="flex gap-3 text-[10px] text-amber-800 font-semibold">
                  <span>Latitud: {newPubLat.toFixed(5)}</span>
                  <span>Longitud: {newPubLng.toFixed(5)}</span>
                </div>
              </div>

              {/* Personal details for trade contact */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-extrabold text-slate-900">2. Datos de Contacto para el Trueque</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">WhatsApp *</label>
                    <input 
                      type="text" 
                      placeholder="+54911..."
                      required
                      value={newPubPhone}
                      onChange={(e) => setNewPubPhone(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Correo (Opcional)</label>
                    <input 
                      type="email" 
                      placeholder="vecino@ejemplo.com"
                      value={newPubEmail}
                      onChange={(e) => setNewPubEmail(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Tu Nombre *</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Marcelo"
                      required
                      value={newPubName}
                      onChange={(e) => setNewPubName(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50"
                    />
                  </div>
                </div>
              </div>

              {/* Submit button */}
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className={`flex-1 ${isEditing ? "bg-violet-600 hover:bg-violet-700 shadow-violet-100/30" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"} text-white font-bold py-3 rounded-xl text-xs shadow-md`}
                >
                  {isEditing ? "Guardar Cambios" : "¡Publicar Ahora!"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ======================================= */}
      {/* 9. MODAL: ESCRIBIR EN EL BLOG (FORM)   */}
      {/* ======================================= */}
      {showCreateBlogModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl overflow-hidden max-w-lg w-full border border-slate-150 shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="bg-indigo-600 text-white p-5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black text-lg">Escribir Entrada del Blog</h3>
                <p className="text-xs text-indigo-100">Comparte historias, novedades vecinales o convocatorias</p>
              </div>
              <button 
                onClick={() => setShowCreateBlogModal(false)}
                className="text-white hover:text-indigo-200 font-extrabold text-xl p-2"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateBlogPost} className="p-6 space-y-4 text-left">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Título de la Entrada *</label>
                <input 
                  type="text" 
                  placeholder="Ej: Crónica de un hermoso trueque dominical"
                  required
                  value={newBlogTitle}
                  onChange={(e) => setNewBlogTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Categoría</label>
                  <select 
                    value={newBlogCategory}
                    onChange={(e) => setNewBlogCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50"
                  >
                    <option value="Testimonio">Testimonio</option>
                    <option value="Consejo">Consejo Práctico</option>
                    <option value="Evento">Convocatoria / Evento</option>
                    <option value="Reflexión">Reflexión / Debate</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Tu Nombre / Firma *</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Romina"
                    required
                    value={newBlogAuthor}
                    onChange={(e) => setNewBlogAuthor(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Contenido de la Entrada *</label>
                <textarea 
                  placeholder="Escribe aquí de forma libre y detallada..."
                  required
                  rows={6}
                  value={newBlogContent}
                  onChange={(e) => setNewBlogContent(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowCreateBlogModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs shadow-md shadow-indigo-100"
                >
                  Publicar Entrada
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 10. FOOTER STATUS BAR */}
      <footer className="bg-slate-900 text-slate-400 py-6 px-4 mt-12 border-t border-slate-800 text-xs text-center shrink-0">
        <div className="max-w-4xl mx-auto space-y-2">
          <p className="font-bold text-slate-200">Ciudad-Trueque © 2026</p>
          <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
            Una plataforma comunitaria autogestionada y de libre acceso para fomentar el trueque cooperativo, la economía solidaria y la sustentabilidad vecinal.
          </p>
        </div>
      </footer>

      {/* 11. MOBILE FLOATING ACTION BUTTON (FAB) FOR PUBLISHING - HIGHLY VISIBLE VIOLET CAPSULE */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 sm:hidden w-[90%] max-w-sm">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { handleOpenCreateModal(); }}
          className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700 text-white py-3.5 px-6 rounded-full shadow-2xl border-2 border-white font-extrabold text-base tracking-wide uppercase relative overflow-hidden"
          id="mobile-fab-publicar"
        >
          {/* Pulsing ring indicator */}
          <span className="absolute inset-0 bg-violet-500/20 animate-pulse pointer-events-none" />
          <Plus className="w-5 h-5 stroke-[3.5]" />
          <span>¡Publicar Trueque!</span>
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-300"></span>
          </span>
        </motion.button>
      </div>

    </div>
  );
}
