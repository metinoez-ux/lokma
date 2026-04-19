const events = [
  { title: "Kermes 1", country: "Almanya" },
  { title: "Kermes 2", country: "Türkiye" },
  { title: "Kermes 3", country: "Bulgaristan" },
];

let countryFilter = "Almanya";

const filteredEvents = events.filter(event => {
  const e = event;
  if (countryFilter !== 'all') {
    if (countryFilter === 'sila_yolu') {
      const isSilaStrict = !!e.isSilaYolu;
      const isSilaSoft = e.title && typeof e.title === 'string' && e.title.toLowerCase().includes('sıla');
      if (!isSilaStrict && !isSilaSoft) return false;
    } else {
      if (e.country !== countryFilter) return false;
    }
  }
  return true;
});

console.log("Almanya selected:", filteredEvents.map(e => e.country));
