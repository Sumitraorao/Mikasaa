export function processCommand(command: string): {
  action: string;
  url?: string;
  isBrowserAction: boolean;
} {
  const lowerCmd = command.toLowerCase().trim();

  // General Browsing: "Open [website name]"
  const openMatch = lowerCmd.match(/^open\s+(.+)$/);
  if (
    openMatch &&
    !lowerCmd.includes("youtube") &&
    !lowerCmd.includes("spotify") &&
    !lowerCmd.includes("whatsapp")
  ) {
    let website = openMatch[1].trim().replace(/\s+/g, "");
    if (!website.includes(".")) {
      website += ".com";
    }
    return {
      action: `Opening ${openMatch[1]} for you, ugh.`,
      url: `https://www.${website}`,
      isBrowserAction: true,
    };
  }

  // Google Search command: "Search for [query]" or "Google [query]"
  const searchMatch = lowerCmd.match(/^(?:search(?:\s+for)?|google)\s+(.+)$/);
  if (searchMatch && !lowerCmd.includes("youtube") && !lowerCmd.includes("spotify") && !lowerCmd.includes("stackoverflow") && !lowerCmd.includes("github")) {
    const query = encodeURIComponent(searchMatch[1].trim());
    return {
      action: `Searching Google for "${searchMatch[1]}". Here you go!`,
      url: `https://www.google.com/search?q=${query}`,
      isBrowserAction: true
    };
  }

  // StackOverflow command: "Search StackOverflow for [query]"
  const soMatch = lowerCmd.match(/^(?:search\s+)?stackoverflow\s+(?:for\s+)?(.+)$/) || lowerCmd.match(/^search\s+stackoverflow\s+for\s+(.+)$/);
  if (soMatch) {
    const query = encodeURIComponent(soMatch[1].trim());
    return {
      action: `Searching StackOverflow for developer wisdom, Sumit!`,
      url: `https://stackoverflow.com/search?q=${query}`,
      isBrowserAction: true
    };
  }

  // GitHub Search command: "Search GitHub for [query]"
  const ghMatch = lowerCmd.match(/^(?:search\s+)?github\s+(?:for\s+)?(.+)$/) || lowerCmd.match(/^search\s+github\s+for\s+(.+)$/);
  if (ghMatch) {
    const query = encodeURIComponent(ghMatch[1].trim());
    return {
      action: `Opening Github to explore repositories for "${ghMatch[1]}".`,
      url: `https://github.com/search?q=${query}`,
      isBrowserAction: true
    };
  }

  // Maps Directions command: "Show directions to [destination]" or "Locate [place]"
  const mapsMatch = lowerCmd.match(/^(?:show\s+directions\s+to|locate|directions\s+to)\s+(.+)$/);
  if (mapsMatch) {
    const query = encodeURIComponent(mapsMatch[1].trim());
    return {
      action: `Navigating Google Maps context to "${mapsMatch[1]}". Prepare for takeoff!`,
      url: `https://www.google.com/maps/search/?api=1&query=${query}`,
      isBrowserAction: true
    };
  }

  // Compose Email: "Send email to [recipient]"
  const emailMatch = lowerCmd.match(/^(?:send\s+email\s+to|email|compose\s+mail\s+to)\s+([^\s]+)$/);
  if (emailMatch) {
    const recipient = emailMatch[1].trim();
    return {
      action: `Preparing your mail client to compose messages for ${recipient}. Keep it professional.`,
      url: `mailto:${recipient}`,
      isBrowserAction: true
    };
  }

  // Media Search: "Play [song/video] on YouTube"
  const ytMatch = lowerCmd.match(/^play\s+(.+?)\s+on\s+youtube$/);
  if (ytMatch) {
    const query = encodeURIComponent(ytMatch[1].trim());
    return {
      action: `Playing ${ytMatch[1]} on YouTube. Don't judge my music taste.`,
      url: `https://www.youtube.com/results?search_query=${query}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Search [query] on Spotify"
  const spotifyMatch = lowerCmd.match(/^search\s+(.+?)\s+on\s+spotify$/);
  if (spotifyMatch) {
    const query = encodeURIComponent(spotifyMatch[1].trim());
    return {
      action: `Searching ${spotifyMatch[1]} on Spotify. Hope it's a banger.`,
      url: `https://open.spotify.com/search/${query}`,
      isBrowserAction: true,
    };
  }

  // WhatsApp Web: "Send a WhatsApp message to [number] saying [message]"
  const waMatch = lowerCmd.match(
    /^send\s+a\s+whatsapp\s+message\s+to\s+([\d\+\s]+)\s+saying\s+(.+)$/,
  );
  if (waMatch) {
    const number = waMatch[1].replace(/\s+/g, "");
    const message = encodeURIComponent(waMatch[2].trim());
    return {
      action: `Sending your message. Let's hope they reply, Sumit.`,
      url: `https://web.whatsapp.com/send?phone=${number}&text=${message}`,
      isBrowserAction: true,
    };
  }

  return { action: "", isBrowserAction: false };
}
