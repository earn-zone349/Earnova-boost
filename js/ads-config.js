/* =====================================================================
   বিজ্ঞাপনের কনফিগ ফাইল (Adsterra) — শুধু এই ফাইলে কোড বসাবে।
   ---------------------------------------------------------------------
   কীভাবে বসাবে:
   1) Adsterra থেকে যে কোড পাবে (<script>...</script> সহ পুরোটা) সেটা
      নিচের জায়গার দুই ব্যাকটিক ( ` ` ) চিহ্নের মাঝখানে পেস্ট করবে।
   2) খালি রাখলে ওই জায়গায় "বিজ্ঞাপনের জায়গা" লেখা বক্স দেখাবে
      (শুধু তুমি বুঝতে পারার জন্য)। সব কোড বসানো হলে
      showPlaceholders: false করে দেবে — তখন খালি বক্স আর দেখাবে না।
   3) Adsterra-তে প্রতিটা জায়গার জন্য আলাদা আলাদা Zone/কোড বানানো ভালো।
   ===================================================================== */
window.ADS_CONFIG = {
  enabled: true,            // false করলে সব বিজ্ঞাপন বন্ধ
  showPlaceholders: true,   // true = কোড না থাকলে "বিজ্ঞাপনের জায়গা" বক্স দেখায়

  /* পপঅ্যান্ডার সময়ের নিয়ম (সেকেন্ডে):
     ১ম পপঅ্যান্ডার → popunderGap1 সেকেন্ড বন্ধ → ২য় পপঅ্যান্ডার →
     popunderGap2 সেকেন্ড বন্ধ → আবার প্রথম থেকে */
  popunderGap1: 60,         // ১ মিনিট
  popunderGap2: 1800,       // ৩০ মিনিট

  linkTitle: 'বিশেষ অফার দেখুন',   // Direct Link কার্ডের লেখা

  /* ---- পুরো সাইটে (সব পেজে) একবার করে চলে ---- */
  socialBar: `<script data-cfasync="false" src="https://bicea.org/14/f014edb7473f3c2aeebae2ae6d3313ae"></script>`,            // Social Bar এর কোড
  popunder:  `<script data-cfasync="false" src="https://afders.org/1/ae60dc0ec9735f23490b70a5c5c9d865"></script>`,            // Popunder এর কোড

  /* ---- বাম সাইডবারের ব্যানার (300x250), সব পেজে একই ---- */
  sidebar: `<script>
  atOptions = {
    'key' : '28cc7969921e4d636d29ed0f593c94bb',
    'format' : 'iframe',
    'height' : 250,
    'width' : 300,
    'params' : {}
  };
</script>
<script src="https://bicea.org/22/28cc7969921e4d636d29ed0f593c94bb"></script>`,

  /* ---- প্রতিটা পেজের নিজস্ব বিজ্ঞাপন ---- */
  pages: {
    /* হোম / সার্ভিস / নতুন অর্ডার পেজ */
    home: {
      top:    `<script>
  atOptions = {
    'key' : '05de21f66a18792cc6ba44dc8a7b665e',
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script src="https://bicea.org/22/05de21f66a18792cc6ba44dc8a7b665e"></script>`,   // উপরের ব্যানার (728x90)
      native: `<script async="async" data-cfasync="false" src="https://bicea.org/21/8f19e53648342de6aae2e803bf00d74f"></script>
<div id="container-8f19e53648342de6aae2e803bf00d74f"></div>`,   // মাঝখানের Native Banner
      bottom: `<script>
  atOptions = {
    'key' : '05de21f66a18792cc6ba44dc8a7b665e',
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script src="https://bicea.org/22/05de21f66a18792cc6ba44dc8a7b665e"></script>`,   // নিচের ব্যানার (728x90)
      link:   `https://arwf.org/4/cf95826647b23fd83423a409afbb7b70`    // Direct Link — শুধু URL, যেমন https://example.com/abc
    },
    /* আমার অর্ডার পেজ */
    orders: {
      top:    `<script>
  atOptions = {
    'key' : '05de21f66a18792cc6ba44dc8a7b665e',
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script src="https://bicea.org/22/05de21f66a18792cc6ba44dc8a7b665e"></script>`,
      native: `<script async="async" data-cfasync="false" src="https://bicea.org/21/8f19e53648342de6aae2e803bf00d74f"></script>
<div id="container-8f19e53648342de6aae2e803bf00d74f"></div>`,
      bottom: `<script>
  atOptions = {
    'key' : '05de21f66a18792cc6ba44dc8a7b665e',
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script src="https://bicea.org/22/05de21f66a18792cc6ba44dc8a7b665e"></script>`,
      link:   `https://arwf.org/4/cf95826647b23fd83423a409afbb7b70`
    },
    /* ওয়ালেট / টাকা জমা পেজ */
    wallet: {
      top:    `<script>
  atOptions = {
    'key' : '05de21f66a18792cc6ba44dc8a7b665e',
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script src="https://bicea.org/22/05de21f66a18792cc6ba44dc8a7b665e"></script>`,
      native: `<script async="async" data-cfasync="false" src="https://bicea.org/21/8f19e53648342de6aae2e803bf00d74f"></script>
<div id="container-8f19e53648342de6aae2e803bf00d74f"></div>`,
      bottom: `<script>
  atOptions = {
    'key' : '05de21f66a18792cc6ba44dc8a7b665e',
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script src="https://bicea.org/22/05de21f66a18792cc6ba44dc8a7b665e"></script>`,
      link:   `https://arwf.org/4/cf95826647b23fd83423a409afbb7b70`
    }
  }
};
