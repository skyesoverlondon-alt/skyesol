var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/admin-site-menu.mjs
var admin_site_menu_exports = {};
__export(admin_site_menu_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(admin_site_menu_exports);
var import_node_crypto = __toESM(require("crypto"), 1);

// netlify/functions/_generated/site-menu-data.mjs
var SITE_MENU = {
  "generatedAt": "2026-02-26T18:50:27.591Z",
  "totalItems": 736,
  "categories": [
    {
      "name": "root",
      "count": 29,
      "items": [
        {
          "urlPath": "/404.html",
          "prettyPath": null,
          "file": "404.html",
          "title": "404 \xB7 Page not found",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/about.html",
          "prettyPath": null,
          "file": "about.html",
          "title": "About the Founder \u2014 Skyes Over London LC",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/admin-menu.html",
          "prettyPath": null,
          "file": "admin-menu.html",
          "title": "Admin Menu \xB7 Site Paths",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/admin.html",
          "prettyPath": null,
          "file": "admin.html",
          "title": "Admin \xB7 Skyes Over London LC",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/blog.html",
          "prettyPath": null,
          "file": "blog.html",
          "title": "Blog \xB7 Skyes Over London LC",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/contact.html",
          "prettyPath": null,
          "file": "contact.html",
          "title": "Contact \u2014 Skyes Over London LC",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/credibility.html",
          "prettyPath": null,
          "file": "credibility.html",
          "title": "Credibility Archive \u2014 Skyes Over London LC",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/dashboard.html",
          "prettyPath": null,
          "file": "dashboard.html",
          "title": "Dashboard \xB7 SOLEnterprises Monitoring",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/index.html",
          "prettyPath": "/",
          "file": "index.html",
          "title": "Skyes Over London LC \u2014 SOLEnterprises Ecosystem",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/intro.html",
          "prettyPath": null,
          "file": "intro.html",
          "title": "Skyes Over London - Cinematic Intro",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/network.html",
          "prettyPath": null,
          "file": "network.html",
          "title": "SOLE Network \u2014 SOLEnterprises Ecosystem",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/platforms.html",
          "prettyPath": null,
          "file": "platforms.html",
          "title": "Kaixu Platforms \u2014 SOLEnterprises AI Division",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/portfolio.html",
          "prettyPath": null,
          "file": "portfolio.html",
          "title": "Portfolio placeholder",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/post.html",
          "prettyPath": null,
          "file": "post.html",
          "title": "Post \xB7 Skyes Over London LC",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/privacy.html",
          "prettyPath": null,
          "file": "privacy.html",
          "title": "Privacy \xB7 Skyes Over London LC",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/sitemap-visual.html",
          "prettyPath": null,
          "file": "sitemap-visual.html",
          "title": "Site Navigation Map \u2014 SOLEnterprises",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/status.html",
          "prettyPath": null,
          "file": "status.html",
          "title": "Status \xB7 SOLEnterprises Network",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/terms.html",
          "prettyPath": null,
          "file": "terms.html",
          "title": "Terms \xB7 Skyes Over London LC",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/thanks.html",
          "prettyPath": null,
          "file": "thanks.html",
          "title": "Message Received \u2014 Skyes Over London LC",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": "/vault.html",
          "prettyPath": null,
          "file": "vault.html",
          "title": "Client Vault \xB7 Skyes Over London LC",
          "ext": ".html",
          "category": "root"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "env.template",
          "title": null,
          "ext": ".template",
          "category": "root"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "manifest.json",
          "title": null,
          "ext": ".json",
          "category": "root"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "netlify.toml",
          "title": null,
          "ext": ".toml",
          "category": "root"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "package.json",
          "title": null,
          "ext": ".json",
          "category": "root"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "README.md",
          "title": null,
          "ext": ".md",
          "category": "root"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "robots.txt",
          "title": null,
          "ext": ".txt",
          "category": "root"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "sitemap.xml",
          "title": null,
          "ext": ".xml",
          "category": "root"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "sw.js",
          "title": null,
          "ext": ".js",
          "category": "root"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Untitled.ipynb",
          "title": null,
          "ext": ".ipynb",
          "category": "root"
        }
      ]
    },
    {
      "name": "_headers",
      "count": 1,
      "items": [
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "_headers",
          "title": null,
          "ext": "",
          "category": "_headers"
        }
      ]
    },
    {
      "name": "_redirects",
      "count": 1,
      "items": [
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "_redirects",
          "title": null,
          "ext": "",
          "category": "_redirects"
        }
      ]
    },
    {
      "name": "about",
      "count": 1,
      "items": [
        {
          "urlPath": "/about/index.html",
          "prettyPath": "/about/",
          "file": "about/index.html",
          "title": "About the Founder \u2014 Skyes Over London LC",
          "ext": ".html",
          "category": "about"
        }
      ]
    },
    {
      "name": "admin",
      "count": 1,
      "items": [
        {
          "urlPath": "/admin/index.html",
          "prettyPath": "/admin/",
          "file": "admin/index.html",
          "title": "Admin \xB7 Skyes Over London LC",
          "ext": ".html",
          "category": "admin"
        }
      ]
    },
    {
      "name": "AI DIRECTIVES",
      "count": 3,
      "items": [
        {
          "urlPath": "/AI%20DIRECTIVES/the%20standard%20for%20editorials.html",
          "prettyPath": null,
          "file": "AI DIRECTIVES/the standard for editorials.html",
          "title": "SKAIXU.SYSTEM: The Operator\u2019s App Launcher (and the Free Launch Kit) | Skyes Over London LC",
          "ext": ".html",
          "category": "AI DIRECTIVES"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "AI DIRECTIVES/kAIxuGateway13_integrationDirective (4).txt",
          "title": null,
          "ext": ".txt",
          "category": "AI DIRECTIVES"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "AI DIRECTIVES/kAIxuGateway13_integrationMaster.txt",
          "title": null,
          "ext": ".txt",
          "category": "AI DIRECTIVES"
        }
      ]
    },
    {
      "name": "APP IDEAS",
      "count": 1,
      "items": [
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "APP IDEAS",
          "title": null,
          "ext": "",
          "category": "APP IDEAS"
        }
      ]
    },
    {
      "name": "arizona-llc-cost-breakdown",
      "count": 1,
      "items": [
        {
          "urlPath": "/arizona-llc-cost-breakdown/index.html",
          "prettyPath": "/arizona-llc-cost-breakdown/",
          "file": "arizona-llc-cost-breakdown/index.html",
          "title": null,
          "ext": ".html",
          "category": "arizona-llc-cost-breakdown"
        }
      ]
    },
    {
      "name": "arizona-tpt-license-who-needs-it",
      "count": 1,
      "items": [
        {
          "urlPath": "/arizona-tpt-license-who-needs-it/index.html",
          "prettyPath": "/arizona-tpt-license-who-needs-it/",
          "file": "arizona-tpt-license-who-needs-it/index.html",
          "title": null,
          "ext": ".html",
          "category": "arizona-tpt-license-who-needs-it"
        }
      ]
    },
    {
      "name": "assets",
      "count": 2,
      "items": [
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "assets/app.js",
          "title": null,
          "ext": ".js",
          "category": "assets"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "assets/style.css",
          "title": null,
          "ext": ".css",
          "category": "assets"
        }
      ]
    },
    {
      "name": "blog",
      "count": 3,
      "items": [
        {
          "urlPath": "/blog/index.html",
          "prettyPath": "/blog/",
          "file": "blog/index.html",
          "title": "Blog \xB7 Skyes Over London LC",
          "ext": ".html",
          "category": "blog"
        },
        {
          "urlPath": "/blog/posts/my-new-post.html",
          "prettyPath": null,
          "file": "blog/posts/my-new-post.html",
          "title": "Placeholder blog post",
          "ext": ".html",
          "category": "blog"
        },
        {
          "urlPath": "/blog/posts/phoenix-llc-checklist.html",
          "prettyPath": null,
          "file": "blog/posts/phoenix-llc-checklist.html",
          "title": "Placeholder blog post",
          "ext": ".html",
          "category": "blog"
        }
      ]
    },
    {
      "name": "Blogs",
      "count": 236,
      "items": [
        {
          "urlPath": "/Blogs/13th%20Sole%20Promotions/Establishing-Business-Development-Firm-Phoenix-AZ.html",
          "prettyPath": null,
          "file": "Blogs/13th Sole Promotions/Establishing-Business-Development-Firm-Phoenix-AZ.html",
          "title": "Skyes Over London LC \u2014 Launch | Phoenix Enterprise Architecture \u2022 LONDON Framework\u2122",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/13th%20Sole%20Promotions/Free-events-Phoenix.html",
          "prettyPath": null,
          "file": "Blogs/13th Sole Promotions/Free-events-Phoenix.html",
          "title": "Things to Do in Phoenix (Feb 2026) \u2014 Free Web & Business Events",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/13th%20Sole%20Promotions/Mysfit's-Modern-Juke-Joint-Experience.html",
          "prettyPath": null,
          "file": "Blogs/13th Sole Promotions/Mysfit's-Modern-Juke-Joint-Experience.html",
          "title": "Skyes Over London | Chicago Doesn\u2019t Need More Gatekeepers \u2014 It Needs Rooms Like This",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/13th%20Sole%20Promotions/Mysfit%E2%80%99s-Modern-Juke-Joint-Experience.html",
          "prettyPath": null,
          "file": "Blogs/13th Sole Promotions/Mysfit\u2019s-Modern-Juke-Joint-Experience.html",
          "title": "Skyes Over London | Chicago Doesn\u2019t Need More Gatekeepers \u2014 It Needs Rooms Like This",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/CommonPhoenixLLCProblems.html",
          "prettyPath": null,
          "file": "Blogs/CommonPhoenixLLCProblems.html",
          "title": "Common Phoenix LLC Mistakes (and the prevention checklists that stop them)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/APPS%20WEVE%20ENGINEERED/FamilyMedPassport.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/APPS WEVE ENGINEERED/FamilyMedPassport.html",
          "title": "FamilyMed Passport: Free Emergency Setup Kit + Medical Passport PDF",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/APPS%20WEVE%20ENGINEERED/KidMedPassport.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/APPS WEVE ENGINEERED/KidMedPassport.html",
          "title": "KidMed Passport \u2014 Free Pediatric Emergency Readiness Kit (Printable + PDF Export)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/APPS%20WEVE%20ENGINEERED/LittleLinguist.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/APPS WEVE ENGINEERED/LittleLinguist.html",
          "title": "Little Linguist Jumpstart Kit (Free) \u2014 7-Day Plan + Printables | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/APPS%20WEVE%20ENGINEERED/skAIxU.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/APPS WEVE ENGINEERED/skAIxU.html",
          "title": "SKAIXU.SYSTEM: The Operator\u2019s App Launcher (and the Free Launch Kit) | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/APPS%20WEVE%20ENGINEERED/skAIxUtheProIDE.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/APPS WEVE ENGINEERED/skAIxUtheProIDE.html",
          "title": "SkAIxu IDE Pro: The Intelligence IDE & App Command Center | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/bar-louie-westgate-glendale-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/bar-louie-westgate-glendale-nightlife-editorial.html",
          "title": "Bar Louie \u2014 Westgate \u2014 Sponsored Editorial (Glendale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/carousel-arcade-bar-westgate-glendale-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/carousel-arcade-bar-westgate-glendale-nightlife-editorial.html",
          "title": "Carousel Arcade Bar (Westgate) \u2014 Sponsored Editorial (Glendale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/chicken-n-pickle-glendale-glendale-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/chicken-n-pickle-glendale-glendale-nightlife-editorial.html",
          "title": "Chicken N Pickle (Glendale) \u2014 Sponsored Editorial (Glendale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/desert-diamond-casino-west-valley-the-rock-bar-glendale-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/desert-diamond-casino-west-valley-the-rock-bar-glendale-nightlife-editorial.html",
          "title": "Desert Diamond Casino \u2014 West Valley (The Rock Bar) \u2014 Sponsored Editorial (Glendale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/fat-tuesday-westgate-glendale-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/fat-tuesday-westgate-glendale-nightlife-editorial.html",
          "title": "Fat Tuesday Westgate \u2014 Sponsored Editorial (Glendale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/fine-ash-cigars-bar-lounge-westgate-glendale-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/fine-ash-cigars-bar-lounge-westgate-glendale-nightlife-editorial.html",
          "title": "Fine Ash Cigars Bar & Lounge (Westgate) \u2014 Sponsored Editorial (Glendale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/index.html",
          "prettyPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/",
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/index.html",
          "title": "Sponsored Editorials \u2014 Glendale Clubs / Nightlife Series (Westgate + Glendale)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/mcfaddens-social-house-westgate-glendale-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/mcfaddens-social-house-westgate-glendale-nightlife-editorial.html",
          "title": "McFadden\u2019s Social House (Westgate) \u2014 Sponsored Editorial (Glendale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/popstroke-glendale-glendale-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/popstroke-glendale-glendale-nightlife-editorial.html",
          "title": "PopStroke Glendale \u2014 Sponsored Editorial (Glendale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/state-48-funk-house-brewery-glendale-glendale-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/state-48-funk-house-brewery-glendale-glendale-nightlife-editorial.html",
          "title": "State 48 Funk House Brewery (Glendale) \u2014 Sponsored Editorial (Glendale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/stir-crazy-comedy-club-westgate-glendale-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/stir-crazy-comedy-club-westgate-glendale-nightlife-editorial.html",
          "title": "Stir Crazy Comedy Club (Westgate) \u2014 Sponsored Editorial (Glendale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/the-lola-cocktail-lab-eatery-westgate-glendale-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/the-lola-cocktail-lab-eatery-westgate-glendale-nightlife-editorial.html",
          "title": "The Lola \u2014 Cocktail Lab & Eatery (Westgate) \u2014 Sponsored Editorial (Glendale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/topgolf-phoenix-glendale-glendale-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/topgolf-phoenix-glendale-glendale-nightlife-editorial.html",
          "title": "Topgolf Phoenix \u2013 Glendale \u2014 Sponsored Editorial (Glendale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/GlendaleArizona/yard-house-westgate-glendale-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/GlendaleArizona/yard-house-westgate-glendale-nightlife-editorial.html",
          "title": "Yard House \u2014 Westgate \u2014 Sponsored Editorial (Glendale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/index.html",
          "prettyPath": "/Blogs/Editorials/ArizonaClubScene/",
          "file": "Blogs/Editorials/ArizonaClubScene/index.html",
          "title": null,
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/12-west-brewing-downtown-mesa-mesa-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/12-west-brewing-downtown-mesa-mesa-nightlife-editorial.html",
          "title": "12 West Brewing (Downtown Mesa) \u2014 Sponsored Editorial (Mesa Nightlife)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/alchemy-48-speakeasy-mesa-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/alchemy-48-speakeasy-mesa-nightlife-editorial.html",
          "title": "Alchemy 48 Speakeasy \u2014 Sponsored Editorial (Mesa Nightlife)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/arizona-distilling-co-mesa-mesa-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/arizona-distilling-co-mesa-mesa-nightlife-editorial.html",
          "title": "Arizona Distilling Co. (Mesa) \u2014 Sponsored Editorial (Mesa Nightlife)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/chupacabra-taproom-mesa-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/chupacabra-taproom-mesa-nightlife-editorial.html",
          "title": "Chupacabra Taproom \u2014 Sponsored Editorial (Mesa Nightlife)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/cider-corps-mesa-taproom-mesa-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/cider-corps-mesa-taproom-mesa-nightlife-editorial.html",
          "title": "Cider Corps (Mesa Taproom) \u2014 Sponsored Editorial (Mesa Nightlife)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/denim-diamonds-mesa-mesa-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/denim-diamonds-mesa-mesa-nightlife-editorial.html",
          "title": "Denim & Diamonds (Mesa) \u2014 Sponsored Editorial (Mesa Nightlife)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/index.html",
          "prettyPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/",
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/index.html",
          "title": "Sponsored Editorials \u2014 Mesa Clubs / Nightlife Series (Downtown + East Valley)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/level-1-arcade-bar-downtown-mesa-mesa-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/level-1-arcade-bar-downtown-mesa-mesa-nightlife-editorial.html",
          "title": "Level 1 Arcade Bar (Downtown Mesa) \u2014 Sponsored Editorial (Mesa Nightlife)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/local-legends-mesa-mesa-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/local-legends-mesa-mesa-nightlife-editorial.html",
          "title": "Local Legends (Mesa) \u2014 Sponsored Editorial (Mesa Nightlife)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/mesa-amphitheatre-mesa-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/mesa-amphitheatre-mesa-nightlife-editorial.html",
          "title": "Mesa Amphitheatre \u2014 Sponsored Editorial (Mesa Nightlife)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/pedal-haus-brewery-mesa-mesa-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/pedal-haus-brewery-mesa-mesa-nightlife-editorial.html",
          "title": "Pedal Haus Brewery (Mesa) \u2014 Sponsored Editorial (Mesa Nightlife)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/phantom-fox-beer-company-mesa-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/phantom-fox-beer-company-mesa-nightlife-editorial.html",
          "title": "Phantom Fox Beer Company \u2014 Sponsored Editorial (Mesa Nightlife)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/the-monastery-bar-grill-mesa-mesa-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/the-monastery-bar-grill-mesa-mesa-nightlife-editorial.html",
          "title": "The Monastery Bar & Grill (Mesa) \u2014 Sponsored Editorial (Mesa Nightlife)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/MesaArizona/the-nile-theater-mesa-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/MesaArizona/the-nile-theater-mesa-nightlife-editorial.html",
          "title": "The Nile Theater \u2014 Sponsored Editorial (Mesa Nightlife)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/bitter-twisted-cocktail-parlour-phoenix-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/bitter-twisted-cocktail-parlour-phoenix-nightlife-editorial.html",
          "title": "Bitter & Twisted Cocktail Parlour \u2014 Sponsored Editorial (Phoenix Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/charlies-phoenix-phoenix-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/charlies-phoenix-phoenix-nightlife-editorial.html",
          "title": "Charlie\u2019s Phoenix \u2014 Sponsored Editorial (Phoenix Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/cobra-arcade-bar-phoenix-phoenix-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/cobra-arcade-bar-phoenix-phoenix-nightlife-editorial.html",
          "title": "Cobra Arcade Bar (Phoenix) \u2014 Sponsored Editorial (Phoenix Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/crescent-ballroom-phoenix-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/crescent-ballroom-phoenix-nightlife-editorial.html",
          "title": "Crescent Ballroom \u2014 Sponsored Editorial (Phoenix Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/gracies-tax-bar-phoenix-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/gracies-tax-bar-phoenix-nightlife-editorial.html",
          "title": "Gracie\u2019s Tax Bar \u2014 Sponsored Editorial (Phoenix Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/hannys-phoenix-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/hannys-phoenix-nightlife-editorial.html",
          "title": "Hanny\u2019s \u2014 Sponsored Editorial (Phoenix Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/index.html",
          "prettyPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/",
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/index.html",
          "title": "Sponsored Editorials \u2014 Phoenix Clubs / Nightlife Series (Downtown + Central)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/karamba-nightclub-phoenix-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/karamba-nightclub-phoenix-nightlife-editorial.html",
          "title": "Karamba Nightclub \u2014 Sponsored Editorial (Phoenix Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/little-rituals-phoenix-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/little-rituals-phoenix-nightlife-editorial.html",
          "title": "Little Rituals \u2014 Sponsored Editorial (Phoenix Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/pigtails-downtown-phoenix-phoenix-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/pigtails-downtown-phoenix-phoenix-nightlife-editorial.html",
          "title": "Pigtails (Downtown Phoenix) \u2014 Sponsored Editorial (Phoenix Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/the-duce-phoenix-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/the-duce-phoenix-nightlife-editorial.html",
          "title": "The Duce \u2014 Sponsored Editorial (Phoenix Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/the-van-buren-phoenix-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/the-van-buren-phoenix-nightlife-editorial.html",
          "title": "The Van Buren \u2014 Sponsored Editorial (Phoenix Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/the-womack-phoenix-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/the-womack-phoenix-nightlife-editorial.html",
          "title": "The Womack \u2014 Sponsored Editorial (Phoenix Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/PhoenixArizona/valley-bar-phoenix-nightlife-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/PhoenixArizona/valley-bar-phoenix-nightlife-editorial.html",
          "title": "Valley Bar \u2014 Sponsored Editorial (Phoenix Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/11-11-nightclub-scottsdale-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/11-11-nightclub-scottsdale-club-editorial.html",
          "title": "11:11 Nightclub \u2014 Sponsored Editorial (Scottsdale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/bottled-blonde-scottsdale-scottsdale-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/bottled-blonde-scottsdale-scottsdale-club-editorial.html",
          "title": "Bottled Blonde Scottsdale \u2014 Sponsored Editorial (Scottsdale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/cake-nightclub-scottsdale-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/cake-nightclub-scottsdale-club-editorial.html",
          "title": "CAKE Nightclub \u2014 Sponsored Editorial (Scottsdale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/casa-amigos-scottsdale-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/casa-amigos-scottsdale-club-editorial.html",
          "title": "Casa Amigos \u2014 Sponsored Editorial (Scottsdale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/cottontail-lounge-w-scottsdale-scottsdale-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/cottontail-lounge-w-scottsdale-scottsdale-club-editorial.html",
          "title": "Cottontail Lounge (W Scottsdale) \u2014 Sponsored Editorial (Scottsdale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/dierks-bentleys-whiskey-row-scottsdale-scottsdale-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/dierks-bentleys-whiskey-row-scottsdale-scottsdale-club-editorial.html",
          "title": "Dierks Bentley\u2019s Whiskey Row (Scottsdale) \u2014 Sponsored Editorial (Scottsdale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/el-hefe-scottsdale-scottsdale-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/el-hefe-scottsdale-scottsdale-club-editorial.html",
          "title": "El Hefe Scottsdale \u2014 Sponsored Editorial (Scottsdale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/index.html",
          "prettyPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/",
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/index.html",
          "title": "Sponsored Editorials \u2014 Scottsdale Clubs Series (Old Town + Entertainment District)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/maya-day-night-scottsdale-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/maya-day-night-scottsdale-club-editorial.html",
          "title": "MAYA Day + Night \u2014 Sponsored Editorial (Scottsdale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/riot-house-scottsdale-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/riot-house-scottsdale-club-editorial.html",
          "title": "RIOT House \u2014 Sponsored Editorial (Scottsdale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/rockbar-inc-scottsdale-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/rockbar-inc-scottsdale-club-editorial.html",
          "title": "Rockbar Inc. \u2014 Sponsored Editorial (Scottsdale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/the-beverly-on-main-scottsdale-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/the-beverly-on-main-scottsdale-club-editorial.html",
          "title": "The Beverly on Main \u2014 Sponsored Editorial (Scottsdale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/the-hot-chick-scottsdale-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/the-hot-chick-scottsdale-club-editorial.html",
          "title": "The Hot Chick \u2014 Sponsored Editorial (Scottsdale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/wasted-grain-scottsdale-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/ScottsdaleArizona/wasted-grain-scottsdale-club-editorial.html",
          "title": "Wasted Grain \u2014 Sponsored Editorial (Scottsdale Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/alibi-rooftop-lounge-tempe-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/alibi-rooftop-lounge-tempe-club-editorial.html",
          "title": "Alibi Rooftop Lounge \u2014 Sponsored Editorial (Tempe Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/casa-tempe-tempe-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/casa-tempe-tempe-club-editorial.html",
          "title": "C.A.S.A. Tempe \u2014 Sponsored Editorial (Tempe Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/darkstar-tempe-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/darkstar-tempe-club-editorial.html",
          "title": "Darkstar \u2014 Sponsored Editorial (Tempe Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/devils-hideaway-tempe-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/devils-hideaway-tempe-club-editorial.html",
          "title": "Devil&#x27;s Hideaway \u2014 Sponsored Editorial (Tempe Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/fat-tuesday-tempe-tempe-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/fat-tuesday-tempe-tempe-club-editorial.html",
          "title": "Fat Tuesday Tempe \u2014 Sponsored Editorial (Tempe Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/idle-hands-tempe-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/idle-hands-tempe-club-editorial.html",
          "title": "Idle Hands \u2014 Sponsored Editorial (Tempe Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/index.html",
          "prettyPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/",
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/index.html",
          "title": "Sponsored Editorials \u2014 Tempe Clubs Series (Mill Ave + Downtown Tempe)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/low-key-piano-bar-tempe-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/low-key-piano-bar-tempe-club-editorial.html",
          "title": "Low Key Piano Bar \u2014 Sponsored Editorial (Tempe Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/monkey-pants-bar-grill-tempe-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/monkey-pants-bar-grill-tempe-club-editorial.html",
          "title": "Monkey Pants Bar & Grill \u2014 Sponsored Editorial (Tempe Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/skysill-rooftop-lounge-tempe-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/skysill-rooftop-lounge-tempe-club-editorial.html",
          "title": "Skysill Rooftop Lounge \u2014 Sponsored Editorial (Tempe Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/society-tempe-tempe-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/society-tempe-tempe-club-editorial.html",
          "title": "Society Tempe \u2014 Sponsored Editorial (Tempe Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/sunbar-tempe-tempe-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/sunbar-tempe-tempe-club-editorial.html",
          "title": "Sunbar Tempe \u2014 Sponsored Editorial (Tempe Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/varsity-tavern-tempe-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/varsity-tavern-tempe-club-editorial.html",
          "title": "Varsity Tavern \u2014 Sponsored Editorial (Tempe Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/ArizonaClubScene/TempeArizona/yucca-tap-room-tempe-club-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/ArizonaClubScene/TempeArizona/yucca-tap-room-tempe-club-editorial.html",
          "title": "Yucca Tap Room \u2014 Sponsored Editorial (Tempe Clubs)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/billions_stolen_fom_American_workers.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/billions_stolen_fom_American_workers.html",
          "title": "Empowering America's Workforce: The Worker & Contractor Resource Center | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Colorado%20AI/adobe-firefly.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Colorado AI/adobe-firefly.html",
          "title": "Adobe Firefly: Generative Media That Plays Nice with Creative Workflows | CA AI & Dev Field Notes",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Colorado%20AI/anthropic.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Colorado AI/anthropic.html",
          "title": "Anthropic: Claude as a Developer Platform (Not Just a Chatbot) | CA AI & Dev Field Notes",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Colorado%20AI/apple-core-ml.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Colorado AI/apple-core-ml.html",
          "title": "Core ML: On-Device AI That Ships with Your App | CA AI & Dev Field Notes",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Colorado%20AI/databricks-mosaic-ai.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Colorado AI/databricks-mosaic-ai.html",
          "title": "Databricks Mosaic AI: Building GenAI Where the Data Already Is | CA AI & Dev Field Notes",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Colorado%20AI/github-copilot.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Colorado AI/github-copilot.html",
          "title": "GitHub Copilot: The Developer Tool That Moved AI Into the Daily Loop | CA AI & Dev Field Notes",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Colorado%20AI/google-vertex-ai.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Colorado AI/google-vertex-ai.html",
          "title": "Vertex AI: When You Want GenAI and MLOps Under One Roof | CA AI & Dev Field Notes",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Colorado%20AI/meta-ai.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Colorado AI/meta-ai.html",
          "title": "Meta AI: The Research Engine Behind a Developer Ecosystem | CA AI & Dev Field Notes",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Colorado%20AI/nvidia-cuda.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Colorado AI/nvidia-cuda.html",
          "title": "CUDA: The Gravity Well of GPU-Accelerated Development | CA AI & Dev Field Notes",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Colorado%20AI/openai.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Colorado AI/openai.html",
          "title": "OpenAI: The API Platform That Turns Models into Products | CA AI & Dev Field Notes",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Colorado%20AI/perplexity.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Colorado AI/perplexity.html",
          "title": "Perplexity: The Answer Engine Pattern (Search + LLM + Sources) | CA AI & Dev Field Notes",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Colorado%20AI/salesforce-einstein-agentforce.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Colorado AI/salesforce-einstein-agentforce.html",
          "title": "Salesforce Einstein & Agentforce: AI That Lives Where the Customers Live | CA AI & Dev Field Notes",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Colorado%20AI/scale-ai.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Colorado AI/scale-ai.html",
          "title": "Scale AI: Data, Evaluation, and Enterprise GenAI Infrastructure | CA AI & Dev Field Notes",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Colorado%20AI/vercel.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Colorado AI/vercel.html",
          "title": "Vercel: Shipping AI Apps Like You Ship Web Apps | CA AI & Dev Field Notes",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Devs%20%26%20AI/ai-gateway-one-contract.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Devs & AI/ai-gateway-one-contract.html",
          "title": "AI Gateways: One Contract to Rule Multi\u2011Provider Models | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Devs%20%26%20AI/magic-links-done-right.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Devs & AI/magic-links-done-right.html",
          "title": "Magic Links Done Right: Passwordless Auth Without Pain | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Devs%20%26%20AI/minimal-rbac-that-works.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Devs & AI/minimal-rbac-that-works.html",
          "title": "RBAC for Humans: Minimal Roles That Actually Work | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Devs%20%26%20AI/neon-schema-versioning.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Devs & AI/neon-schema-versioning.html",
          "title": "Neon Postgres: Schema Versioning Without Tears | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Devs%20%26%20AI/netlify-functions-practical-patterns.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Devs & AI/netlify-functions-practical-patterns.html",
          "title": "Netlify Functions at Scale: Practical Patterns for Real Apps | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Devs%20%26%20AI/observability-for-ai-apps.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Devs & AI/observability-for-ai-apps.html",
          "title": "Observability for AI Apps: Traces, Prompts, and Policy | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Devs%20%26%20AI/offline-first-ai-patterns.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Devs & AI/offline-first-ai-patterns.html",
          "title": "Edge AI on a Budget: Offline\u2011First Patterns That Scale | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Devs%20%26%20AI/prompt-hygiene-production.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Devs & AI/prompt-hygiene-production.html",
          "title": "The Hidden Cost of Context: Prompt Hygiene for Production | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Devs%20%26%20AI/rag-retrieval-that-doesnt-lie.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Devs & AI/rag-retrieval-that-doesnt-lie.html",
          "title": "RAG Is Not a Vibe: Retrieval That Doesn\u2019t Lie | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Devs%20%26%20AI/script-to-system-productizing-dev-work.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Devs & AI/script-to-system-productizing-dev-work.html",
          "title": "From Script to System: Productizing Dev Work Without Killing Velocity | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Devs%20%26%20AI/shipping-like-a-scientist.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Devs & AI/shipping-like-a-scientist.html",
          "title": "Shipping Like a Scientist: Experiment Loops for Product Teams | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Devs%20%26%20AI/token-economics-indisputable-billing.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Devs & AI/token-economics-indisputable-billing.html",
          "title": "Token Economics: How to Make AI Billing Indisputable | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Devs%20%26%20AI/why-blocked-ux.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Devs & AI/why-blocked-ux.html",
          "title": "Guardrails Without Rage: Designing \u2018Why Blocked\u2019 UX | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/disclaimer.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/disclaimer.html",
          "title": "Editorials Disclaimer",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/index.html",
          "prettyPath": "/Blogs/Editorials/",
          "file": "Blogs/Editorials/index.html",
          "title": "Editorials Index",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/NorthStar/arizona-tpt-record-posture-phoenix-operators.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/NorthStar/arizona-tpt-record-posture-phoenix-operators.html",
          "title": "Arizona TPT for Phoenix Operators: The Record Posture That Survives Filing Season | NorthStar Office & Accounting LLC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/NorthStar/bank-ready-financials-phoenix-loans-lines.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/NorthStar/bank-ready-financials-phoenix-loans-lines.html",
          "title": "Bank-Ready Financials: How Phoenix Businesses Win Loans and Lines of Credit | NorthStar Office & Accounting LLC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/NorthStar/phoenix-1099-contractor-tracking-year-end-ready.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/NorthStar/phoenix-1099-contractor-tracking-year-end-ready.html",
          "title": "Phoenix 1099 Contractor Tracking: The Cadence That Prevents Year-End Chaos | NorthStar Office & Accounting LLC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/NorthStar/phoenix-cash-flow-forecasting-13-week-clarity.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/NorthStar/phoenix-cash-flow-forecasting-13-week-clarity.html",
          "title": "Phoenix Cash-Flow Forecasting: The 13-Week System That Stops Surprises | NorthStar Office & Accounting LLC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/NorthStar/phoenix-payroll-cadence-quarter-close-discipline.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/NorthStar/phoenix-payroll-cadence-quarter-close-discipline.html",
          "title": "Phoenix Payroll Cadence: The Quarter-Close Discipline That Prevents Penalties | NorthStar Office & Accounting LLC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/NorthStar/phoenix-quickbooks-cleanup-ledger-rescue.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/NorthStar/phoenix-quickbooks-cleanup-ledger-rescue.html",
          "title": "Phoenix QuickBooks Cleanup: The Ledger Rescue That Turns Chaos Into Tax-Ready Books | NorthStar Office & Accounting LLC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/NorthStar/phoenix-year-end-close-30-day-playbook.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/NorthStar/phoenix-year-end-close-30-day-playbook.html",
          "title": "Phoenix Year-End Close: The 30-Day Playbook to Walk Into Tax Season Calmly | NorthStar Office & Accounting LLC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/One-Website-Can't-Carry-Your-Authority-Alone.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/One-Website-Can't-Carry-Your-Authority-Alone.html",
          "title": "Sentinel Web Authority\u2122 \u2014 Distributed SEO & Brand Authority System | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/privacy.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/privacy.html",
          "title": "Editorials Privacy",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/acronym-techwear-precision-systems.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/acronym-techwear-precision-systems.html",
          "title": "ACRONYM\xAE \u2014 Sponsored Editorial",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/ashluxe-africa-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/ashluxe-africa-editorial.html",
          "title": "ASHLUXE \u2014 Sponsored Editorial (Africa)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/free-the-youth-africa-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/free-the-youth-africa-editorial.html",
          "title": "Free The Youth \u2014 Sponsored Editorial (Africa)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/galxboy-africa-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/galxboy-africa-editorial.html",
          "title": "GALXBOY \u2014 Sponsored Editorial (Africa)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/grade-africa-africa-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/grade-africa-africa-editorial.html",
          "title": "Grade Africa \u2014 Sponsored Editorial (Africa)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/index.html",
          "prettyPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/",
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/index.html",
          "title": "Sponsored Editorials \u2014 Africa Series (Edgy Streetwear / Techwear-Adjacent)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/jekkah-africa-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/jekkah-africa-editorial.html",
          "title": "JEKKAH \u2014 Sponsored Editorial (Africa)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/kitu-kali-africa-africa-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/kitu-kali-africa-africa-editorial.html",
          "title": "Kitu Kali Africa \u2014 Sponsored Editorial (Africa)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/nairobi-apparel-district-africa-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/nairobi-apparel-district-africa-editorial.html",
          "title": "Nairobi Apparel District \u2014 Sponsored Editorial (Africa)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/nkwo-africa-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/nkwo-africa-editorial.html",
          "title": "NKWO \u2014 Sponsored Editorial (Africa)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/one-way-kenya-africa-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/one-way-kenya-africa-editorial.html",
          "title": "One Way Kenya \u2014 Sponsored Editorial (Africa)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/orange-culture-africa-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/orange-culture-africa-editorial.html",
          "title": "Orange Culture \u2014 Sponsored Editorial (Africa)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/unknown-government-unknwngov-africa-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/unknown-government-unknwngov-africa-editorial.html",
          "title": "Unknown Government (UNKNWN.GOV) \u2014 Sponsored Editorial (Africa)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/wafflesncream-waf-africa-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/wafflesncream-waf-africa-editorial.html",
          "title": "WAFFLESNCREAM (waf.) \u2014 Sponsored Editorial (Africa)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Africas%20Got%20Sole!/we-are-gods-africa-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Africas Got Sole!/we-are-gods-africa-editorial.html",
          "title": "We Are Gods \u2014 Sponsored Editorial (Africa)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/and-wander-mountain-fashion-hybrid.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/and-wander-mountain-fashion-hybrid.html",
          "title": "and wander \u2014 Sponsored Editorial",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/arcteryx-veilance-urban-systems.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/arcteryx-veilance-urban-systems.html",
          "title": "Arc\u2019teryx (Veilance) \u2014 Sponsored Editorial",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/boris-bidjan-saberi-11bybbs-material-ritual.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/boris-bidjan-saberi-11bybbs-material-ritual.html",
          "title": "Boris Bidjan Saberi (11 by BBS) \u2014 Sponsored Editorial",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/cp-company-garment-dye-innovation.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/cp-company-garment-dye-innovation.html",
          "title": "C.P. Company \u2014 Sponsored Editorial",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/demobaza-dystopian-avant-garde-cyber.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/demobaza-dystopian-avant-garde-cyber.html",
          "title": "DEMOBAZA \u2014 Sponsored Editorial",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/guerrilla-group-industrial-fiction-garments.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/guerrilla-group-industrial-fiction-garments.html",
          "title": "Guerrilla-Group\xAE \u2014 Sponsored Editorial",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/hamcus-dystopian-utility-modular.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/hamcus-dystopian-utility-modular.html",
          "title": "HAMCUS \u2014 Sponsored Editorial",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/index.html",
          "prettyPath": "/Blogs/Editorials/Techwear/",
          "file": "Blogs/Editorials/Techwear/index.html",
          "title": "Sponsored Editorials \u2014 Overseas Techwear / Technical Style",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/maharishi-pacifist-military-utility.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/maharishi-pacifist-military-utility.html",
          "title": "Maharishi \u2014 Sponsored Editorial",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/all-in-one-phx-phoenix-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/all-in-one-phx-phoenix-editorial.html",
          "title": "All In One PHX \u2014 Sponsored Editorial (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/common-hype-phoenix-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/common-hype-phoenix-editorial.html",
          "title": "Common Hype \u2014 Sponsored Editorial (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/cowtown-skateboards-phoenix-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/cowtown-skateboards-phoenix-editorial.html",
          "title": "Cowtown Skateboards \u2014 Sponsored Editorial (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/hands-eyes-mind-phoenix-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/hands-eyes-mind-phoenix-editorial.html",
          "title": "Hands Eyes Mind \u2014 Sponsored Editorial (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/index.html",
          "prettyPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/",
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/index.html",
          "title": "Sponsored Editorials \u2014 Phoenix Series (Streetwear / Techwear-Adjacent)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/ito-brand-phoenix-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/ito-brand-phoenix-editorial.html",
          "title": "Ito-brand \u2014 Sponsored Editorial (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/king-duck-phoenix-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/king-duck-phoenix-editorial.html",
          "title": "King & Duck \u2014 Sponsored Editorial (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/manor-phx-phoenix-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/manor-phx-phoenix-editorial.html",
          "title": "Manor PHX \u2014 Sponsored Editorial (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/oxdx-clothing-phoenix-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/oxdx-clothing-phoenix-editorial.html",
          "title": "OXDX Clothing \u2014 Sponsored Editorial (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/antique-sugar-vintage-clothing-phoenix-batch2-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/antique-sugar-vintage-clothing-phoenix-batch2-editorial.html",
          "title": "Antique Sugar Vintage Clothing \u2014 Sponsored Editorial (Phoenix \u2022 Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/bad-birdie-phoenix-batch2-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/bad-birdie-phoenix-batch2-editorial.html",
          "title": "Bad Birdie \u2014 Sponsored Editorial (Phoenix \u2022 Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/bunky-boutique-phoenix-batch2-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/bunky-boutique-phoenix-batch2-editorial.html",
          "title": "Bunky Boutique \u2014 Sponsored Editorial (Phoenix \u2022 Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/dixxon-flannel-co-tempe-showroom-phoenix-batch2-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/dixxon-flannel-co-tempe-showroom-phoenix-batch2-editorial.html",
          "title": "Dixxon Flannel Co. (Tempe Showroom) \u2014 Sponsored Editorial (Phoenix \u2022 Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/fourtillfour-phoenix-batch2-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/fourtillfour-phoenix-batch2-editorial.html",
          "title": "Fourtillfour \u2014 Sponsored Editorial (Phoenix \u2022 Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/index.html",
          "prettyPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/",
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/index.html",
          "title": "Sponsored Editorials \u2014 Phoenix Series (Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/kimes-ranch-phoenix-batch2-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/kimes-ranch-phoenix-batch2-editorial.html",
          "title": "Kimes Ranch \u2014 Sponsored Editorial (Phoenix \u2022 Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/kiss-me-kate-boutique-phoenix-batch2-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/kiss-me-kate-boutique-phoenix-batch2-editorial.html",
          "title": "Kiss Me Kate Boutique \u2014 Sponsored Editorial (Phoenix \u2022 Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/norde-scottsdale-phoenix-batch2-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/norde-scottsdale-phoenix-batch2-editorial.html",
          "title": "Norde Scottsdale \u2014 Sponsored Editorial (Phoenix \u2022 Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/objects-phoenix-batch2-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/objects-phoenix-batch2-editorial.html",
          "title": "OBJECTS \u2014 Sponsored Editorial (Phoenix \u2022 Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/phoenix-general-phoenix-batch2-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/phoenix-general-phoenix-batch2-editorial.html",
          "title": "Phoenix General \u2014 Sponsored Editorial (Phoenix \u2022 Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/purple-lizard-boutique-phoenix-batch2-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/purple-lizard-boutique-phoenix-batch2-editorial.html",
          "title": "Purple Lizard Boutique \u2014 Sponsored Editorial (Phoenix \u2022 Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/pxg-apparel-parsons-xtreme-golf-phoenix-batch2-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/pxg-apparel-parsons-xtreme-golf-phoenix-batch2-editorial.html",
          "title": "PXG Apparel (Parsons Xtreme Golf) \u2014 Sponsored Editorial (Phoenix \u2022 Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/rolling-rack-boutique-phoenix-batch2-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/Phoenix-Arizona-Batch-2/rolling-rack-boutique-phoenix-batch2-editorial.html",
          "title": "Rolling Rack Boutique \u2014 Sponsored Editorial (Phoenix \u2022 Batch 2)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/phoenix-fashion-week-shop-phoenix-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/phoenix-fashion-week-shop-phoenix-editorial.html",
          "title": "Phoenix Fashion Week (Shop) \u2014 Sponsored Editorial (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/rebel-reaper-clothing-company-phoenix-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/rebel-reaper-clothing-company-phoenix-editorial.html",
          "title": "Rebel Reaper Clothing Company \u2014 Sponsored Editorial (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/state-forty-eight-phoenix-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/state-forty-eight-phoenix-editorial.html",
          "title": "State Forty Eight \u2014 Sponsored Editorial (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/throne-of-grace-clothing-phoenix-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/throne-of-grace-clothing-phoenix-editorial.html",
          "title": "Throne of Grace Clothing \u2014 Sponsored Editorial (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/Phoenix-Arizona/trill-hip-hop-shop-phoenix-editorial.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/Phoenix-Arizona/trill-hip-hop-shop-phoenix-editorial.html",
          "title": "Trill Hip-Hop Shop \u2014 Sponsored Editorial (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/riot-division-monoproduct-techwear-philosophy.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/riot-division-monoproduct-techwear-philosophy.html",
          "title": "RIOT DIVISION \u2014 Sponsored Editorial",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/stone-island-material-research-culture.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/stone-island-material-research-culture.html",
          "title": "Stone Island \u2014 Sponsored Editorial",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/ten-c-forever-collection-anti-obsolescence.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/ten-c-forever-collection-anti-obsolescence.html",
          "title": "Ten c \u2014 Sponsored Editorial",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/Techwear/vollebak-clothes-from-the-future.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/Techwear/vollebak-clothes-from-the-future.html",
          "title": "Vollebak \u2014 Sponsored Editorial",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/terms.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/terms.html",
          "title": "Editorials Terms",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Editorials/WebPile%20Pro%E2%80%94Monaco%20Editor.html",
          "prettyPath": null,
          "file": "Blogs/Editorials/WebPile Pro\u2014Monaco Editor.html",
          "title": null,
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Houston%20Texas%20Devs%20%26%20AI/houston-ai-bmc-software.html",
          "prettyPath": null,
          "file": "Blogs/Houston Texas Devs & AI/houston-ai-bmc-software.html",
          "title": "Houston AI & Dev Spotlight: BMC Software | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Houston%20Texas%20Devs%20%26%20AI/houston-ai-cemvita.html",
          "prettyPath": null,
          "file": "Blogs/Houston Texas Devs & AI/houston-ai-cemvita.html",
          "title": "Houston AI & Dev Spotlight: Cemvita | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Houston%20Texas%20Devs%20%26%20AI/houston-ai-chaione.html",
          "prettyPath": null,
          "file": "Blogs/Houston Texas Devs & AI/houston-ai-chaione.html",
          "title": "Houston AI & Dev Spotlight: ChaiOne | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Houston%20Texas%20Devs%20%26%20AI/houston-ai-data-gumbo.html",
          "prettyPath": null,
          "file": "Blogs/Houston Texas Devs & AI/houston-ai-data-gumbo.html",
          "title": "Houston AI & Dev Spotlight: Data Gumbo | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Houston%20Texas%20Devs%20%26%20AI/houston-ai-halliburton-digital.html",
          "prettyPath": null,
          "file": "Blogs/Houston Texas Devs & AI/houston-ai-halliburton-digital.html",
          "title": "Houston AI & Dev Spotlight: Halliburton | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Houston%20Texas%20Devs%20%26%20AI/houston-ai-kbr.html",
          "prettyPath": null,
          "file": "Blogs/Houston Texas Devs & AI/houston-ai-kbr.html",
          "title": "Houston AI & Dev Spotlight: KBR | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Houston%20Texas%20Devs%20%26%20AI/houston-ai-pros.html",
          "prettyPath": null,
          "file": "Blogs/Houston Texas Devs & AI/houston-ai-pros.html",
          "title": "Houston AI & Dev Spotlight: PROS | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Houston%20Texas%20Devs%20%26%20AI/houston-ai-slb-innovation-factori.html",
          "prettyPath": null,
          "file": "Blogs/Houston Texas Devs & AI/houston-ai-slb-innovation-factori.html",
          "title": "Houston AI & Dev Spotlight: SLB | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Houston%20Texas%20Devs%20%26%20AI/houston-dev-hpe-headquarters.html",
          "prettyPath": null,
          "file": "Blogs/Houston Texas Devs & AI/houston-dev-hpe-headquarters.html",
          "title": "Houston AI & Dev Spotlight: Hewlett Packard Enterprise | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Houston%20Texas%20Devs%20%26%20AI/houston-dev-softeq.html",
          "prettyPath": null,
          "file": "Blogs/Houston Texas Devs & AI/houston-dev-softeq.html",
          "title": "Houston AI & Dev Spotlight: Softeq | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Houston%20Texas%20Devs%20%26%20AI/houston-enterprise-chevron-hq.html",
          "prettyPath": null,
          "file": "Blogs/Houston Texas Devs & AI/houston-enterprise-chevron-hq.html",
          "title": "Houston AI & Dev Spotlight: Chevron | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Houston%20Texas%20Devs%20%26%20AI/houston-space-axiom-space.html",
          "prettyPath": null,
          "file": "Blogs/Houston Texas Devs & AI/houston-space-axiom-space.html",
          "title": "Houston AI & Dev Spotlight: Axiom Space | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Houston%20Texas%20Devs%20%26%20AI/houston-space-intuitive-machines.html",
          "prettyPath": null,
          "file": "Blogs/Houston Texas Devs & AI/houston-space-intuitive-machines.html",
          "title": "Houston AI & Dev Spotlight: Intuitive Machines | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Mysfit'sModernJukeJointExperience.html",
          "prettyPath": null,
          "file": "Blogs/Mysfit'sModernJukeJointExperience.html",
          "title": "Mysfit\u2019s Modern Juke Joint Experience | #NoGateKeepingChicago",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Mysfit%E2%80%99sModernJukeJointExperience.html",
          "prettyPath": null,
          "file": "Blogs/Mysfit\u2019sModernJukeJointExperience.html",
          "title": "Mysfit\u2019s Modern Juke Joint Experience | #NoGateKeepingChicago",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/PayHawk%20Is%20Revolutionizing%20Pay%20Plan%20Design%20for%20Small%20Businesses.html",
          "prettyPath": null,
          "file": "Blogs/PayHawk Is Revolutionizing Pay Plan Design for Small Businesses.html",
          "title": "PayHawk: AI-Powered Pay Plan Compliance Wizard | Stop Guessing, Start Complying",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/01_phoenix_start_business_playbook.html",
          "prettyPath": null,
          "file": "Blogs/Phoenix Arizona/01_phoenix_start_business_playbook.html",
          "title": "Start & Run a Business in Phoenix, AZ (LLC + Compliance + Profit Systems)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/02_how_to_start_llc_arizona_phoenix.html",
          "prettyPath": null,
          "file": "Blogs/Phoenix Arizona/02_how_to_start_llc_arizona_phoenix.html",
          "title": "How to Start an LLC in Arizona (Phoenix Step\u2011by\u2011Step, Operator Clean)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/03_arizona_llc_cost_breakdown.html",
          "prettyPath": null,
          "file": "Blogs/Phoenix Arizona/03_arizona_llc_cost_breakdown.html",
          "title": "How Much Does an LLC Cost in Arizona? (Real Phoenix Operator Budget)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/04_phoenix_business_license_requirements.html",
          "prettyPath": null,
          "file": "Blogs/Phoenix Arizona/04_phoenix_business_license_requirements.html",
          "title": "Do I Need a Business License in Phoenix, AZ? (What Phoenix Actually Requires)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/05_arizona_tpt_license_who_needs_it.html",
          "prettyPath": null,
          "file": "Blogs/Phoenix Arizona/05_arizona_tpt_license_who_needs_it.html",
          "title": "Do I Need a TPT License in Arizona? (Phoenix Operators: Read This First)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/06_how_to_get_an_ein_arizona.html",
          "prettyPath": null,
          "file": "Blogs/Phoenix Arizona/06_how_to_get_an_ein_arizona.html",
          "title": "How to Get an EIN in Arizona (Phoenix Owners: Free, Fast, Correct)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/07_arizona_statutory_agent_registered_agent.html",
          "prettyPath": null,
          "file": "Blogs/Phoenix Arizona/07_arizona_statutory_agent_registered_agent.html",
          "title": "Do I Need a Registered Agent in Arizona? (Statutory Agent: The Operator Guide)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/08_phoenix_home_based_business_zoning_rules.html",
          "prettyPath": null,
          "file": "Blogs/Phoenix Arizona/08_phoenix_home_based_business_zoning_rules.html",
          "title": "Phoenix Zoning & Home\u2011Based Business Rules (Home Occupations: Operator Playbook)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/09_phoenix_sales_tax_vs_arizona_tpt.html",
          "prettyPath": null,
          "file": "Blogs/Phoenix Arizona/09_phoenix_sales_tax_vs_arizona_tpt.html",
          "title": "Phoenix Sales Tax vs Arizona TPT (What\u2019s the Difference\u2014and Why You Care)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/10_arizona_contracts_deposits_invoicing_system.html",
          "prettyPath": null,
          "file": "Blogs/Phoenix Arizona/10_arizona_contracts_deposits_invoicing_system.html",
          "title": "Arizona Contracts, Deposits & Invoicing (Phoenix Operator System That Actually Collects)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/arizona-llc-cost-breakdown/index.html",
          "prettyPath": "/Blogs/Phoenix%20Arizona/arizona-llc-cost-breakdown/",
          "file": "Blogs/Phoenix Arizona/arizona-llc-cost-breakdown/index.html",
          "title": "Arizona LLC Cost Breakdown",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/arizona-tpt-license-who-needs-it/index.html",
          "prettyPath": "/Blogs/Phoenix%20Arizona/arizona-tpt-license-who-needs-it/",
          "file": "Blogs/Phoenix Arizona/arizona-tpt-license-who-needs-it/index.html",
          "title": "Arizona TPT License: Who Needs It?",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/how-to-get-an-ein-arizona/index.html",
          "prettyPath": "/Blogs/Phoenix%20Arizona/how-to-get-an-ein-arizona/",
          "file": "Blogs/Phoenix Arizona/how-to-get-an-ein-arizona/index.html",
          "title": "How to Get an EIN in Arizona",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/how-to-start-an-llc-in-arizona-phoenix/index.html",
          "prettyPath": "/Blogs/Phoenix%20Arizona/how-to-start-an-llc-in-arizona-phoenix/",
          "file": "Blogs/Phoenix Arizona/how-to-start-an-llc-in-arizona-phoenix/index.html",
          "title": "How to Start an LLC in Arizona (Phoenix)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/phoenix-business-license-requirements/index.html",
          "prettyPath": "/Blogs/Phoenix%20Arizona/phoenix-business-license-requirements/",
          "file": "Blogs/Phoenix Arizona/phoenix-business-license-requirements/index.html",
          "title": "Phoenix Business License Requirements",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Phoenix%20Arizona/phoenix-start-business-llc-compliance-playbook/index.html",
          "prettyPath": "/Blogs/Phoenix%20Arizona/phoenix-start-business-llc-compliance-playbook/",
          "file": "Blogs/Phoenix Arizona/phoenix-start-business-llc-compliance-playbook/index.html",
          "title": "Phoenix Start Business & LLC Compliance Playbook",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/PhoenixValleyBlogHome.html",
          "prettyPath": null,
          "file": "Blogs/PhoenixValleyBlogHome.html",
          "title": "Blog Hub",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Skaixu/skaixu_blog_01_patch-driven-editing-the-anti-drift-contract-for-ai-code-changes.html",
          "prettyPath": null,
          "file": "Blogs/Skaixu/skaixu_blog_01_patch-driven-editing-the-anti-drift-contract-for-ai-code-changes.html",
          "title": "Patch-Driven Editing: The Anti-Drift Contract for AI Code Changes | SkAIxu IDE Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Skaixu/skaixu_blog_02_preview-to-patch-targeting-click-to-edit-that-stops-ambiguity.html",
          "prettyPath": null,
          "file": "Blogs/Skaixu/skaixu_blog_02_preview-to-patch-targeting-click-to-edit-that-stops-ambiguity.html",
          "title": "Preview-to-Patch Targeting: Click-to-Edit That Stops Ambiguity | SkAIxu IDE Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Skaixu/skaixu_blog_03_offline-first-ide-local-persistence-that-survives-real-life.html",
          "prettyPath": null,
          "file": "Blogs/Skaixu/skaixu_blog_03_offline-first-ide-local-persistence-that-survives-real-life.html",
          "title": "Offline-First IDE: Local Persistence That Survives Real Life | SkAIxu IDE Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Skaixu/skaixu_blog_04_pwa-install-portable-workspace-your-ide-in-one-tap.html",
          "prettyPath": null,
          "file": "Blogs/Skaixu/skaixu_blog_04_pwa-install-portable-workspace-your-ide-in-one-tap.html",
          "title": "PWA Install + Portable Workspace: Your IDE in One Tap | SkAIxu IDE Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Skaixu/skaixu_blog_05_governance-first-ai-routing-model-access-designed-like-security.html",
          "prettyPath": null,
          "file": "Blogs/Skaixu/skaixu_blog_05_governance-first-ai-routing-model-access-designed-like-security.html",
          "title": "Governance-First AI Routing: Model Access Designed Like Security | SkAIxu IDE Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Skaixu/skaixu_blog_06_undo-redo-as-a-safety-rail-reliability-for-rapid-iteration.html",
          "prettyPath": null,
          "file": "Blogs/Skaixu/skaixu_blog_06_undo-redo-as-a-safety-rail-reliability-for-rapid-iteration.html",
          "title": "Undo/Redo as a Safety Rail: Reliability for Rapid Iteration | SkAIxu IDE Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Skaixu/skaixu_blog_07_from-prompt-chaos-to-engineering-discipline-a-practical-loop.html",
          "prettyPath": null,
          "file": "Blogs/Skaixu/skaixu_blog_07_from-prompt-chaos-to-engineering-discipline-a-practical-loop.html",
          "title": "From Prompt Chaos to Engineering Discipline: A Practical Loop | SkAIxu IDE Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Skaixu/skaixu_blog_08_element-level-refactors-without-breaking-layout.html",
          "prettyPath": null,
          "file": "Blogs/Skaixu/skaixu_blog_08_element-level-refactors-without-breaking-layout.html",
          "title": "Element-Level Refactors Without Breaking Layout | SkAIxu IDE Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Skaixu/skaixu_blog_09_agency-workflow-faster-client-builds-without-losing-control.html",
          "prettyPath": null,
          "file": "Blogs/Skaixu/skaixu_blog_09_agency-workflow-faster-client-builds-without-losing-control.html",
          "title": "Agency Workflow: Faster Client Builds Without Losing Control | SkAIxu IDE Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Skaixu/skaixu_blog_10_auditability-without-enterprise-overhead.html",
          "prettyPath": null,
          "file": "Blogs/Skaixu/skaixu_blog_10_auditability-without-enterprise-overhead.html",
          "title": "Auditability Without Enterprise Overhead | SkAIxu IDE Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Skaixu/skaixu_blog_11_why-production-endpoints-must-be-closed-by-default.html",
          "prettyPath": null,
          "file": "Blogs/Skaixu/skaixu_blog_11_why-production-endpoints-must-be-closed-by-default.html",
          "title": "Why Production Endpoints Must Be Closed by Default | SkAIxu IDE Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Skaixu/skaixu_blog_12_pattern-libraries-patch-recipes-scale-changes-without-drift.html",
          "prettyPath": null,
          "file": "Blogs/Skaixu/skaixu_blog_12_pattern-libraries-patch-recipes-scale-changes-without-drift.html",
          "title": "Pattern Libraries + Patch Recipes: Scale Changes Without Drift | SkAIxu IDE Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Skaixu/skaixu_blog_13_the-operator-s-ide-designing-for-pressure-not-demos.html",
          "prettyPath": null,
          "file": "Blogs/Skaixu/skaixu_blog_13_the-operator-s-ide-designing-for-pressure-not-demos.html",
          "title": "The Operator\u2019s IDE: Designing for Pressure, Not Demos | SkAIxu IDE Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/SkyeDocx.html",
          "prettyPath": null,
          "file": "Blogs/SkyeDocx.html",
          "title": "SkyeDocx: The Document Platform Built for Real Operators | Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/sol-ops-field-brief.html",
          "prettyPath": null,
          "file": "Blogs/sol-ops-field-brief.html",
          "title": null,
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/template.html",
          "prettyPath": null,
          "file": "Blogs/template.html",
          "title": "The Operator\u2019s Advantage: Proof-First Businesses in the Next Economy | Nexus Hub Blog",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/web-development-phoenix-az-apex-operator-playbook.html",
          "prettyPath": null,
          "file": "Blogs/web-development-phoenix-az-apex-operator-playbook.html",
          "title": "Web Development in Phoenix, AZ: The APEX Operator Playbook for Fast Sites, Higher Rankings, and Real Leads (2026)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/Web%20Development%20in%20Phoenix%2C%20AZ.html",
          "prettyPath": null,
          "file": "Blogs/Web Development in Phoenix, AZ.html",
          "title": "Web Development in Phoenix, AZ | Modern Websites, SEO, Speed & Conversions (2026 Guide)",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/What-Even-Is-SEO.html",
          "prettyPath": null,
          "file": "Blogs/What-Even-Is-SEO.html",
          "title": null,
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": "/Blogs/WhenLeadsGoUp%2CFireDrillsGoUpToo.html",
          "prettyPath": null,
          "file": "Blogs/WhenLeadsGoUp,FireDrillsGoUpToo.html",
          "title": "Arizona\u2019s \u201CBusy but Not In Control\u201D Trap \u2014 Skyes Over London LC",
          "ext": ".html",
          "category": "Blogs"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Blogs/blog-manifest.json",
          "title": null,
          "ext": ".json",
          "category": "Blogs"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Blogs/Editorials/assets/theme.css",
          "title": null,
          "ext": ".css",
          "category": "Blogs"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Blogs/Editorials/assets/theme.js",
          "title": null,
          "ext": ".js",
          "category": "Blogs"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Blogs/Editorials/scripts.js",
          "title": null,
          "ext": ".js",
          "category": "Blogs"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Blogs/Editorials/style.css",
          "title": null,
          "ext": ".css",
          "category": "Blogs"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Blogs/Houston froze on January 25, 2026. html",
          "title": null,
          "ext": ". html",
          "category": "Blogs"
        }
      ]
    },
    {
      "name": "Case Studies",
      "count": 91,
      "items": [
        {
          "urlPath": "/Case%20Studies/2026/best-buy-retail-fulfillment-last-mile-proof.html",
          "prettyPath": null,
          "file": "Case Studies/2026/best-buy-retail-fulfillment-last-mile-proof.html",
          "title": "Best Buy: Retail Fulfillment Enablement With Last\u2011Mile Proof Discipline \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/cvs-pharmacy-medication-delivery-ops-chain-of-custody.html",
          "prettyPath": null,
          "file": "Case Studies/2026/cvs-pharmacy-medication-delivery-ops-chain-of-custody.html",
          "title": "CVS Pharmacy: Medication Delivery Operations With Chain\u2011of\u2011Custody Discipline \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/globe-life-liberty-national-trust-first-sales-ops-reporting.html",
          "prettyPath": null,
          "file": "Case Studies/2026/globe-life-liberty-national-trust-first-sales-ops-reporting.html",
          "title": "Globe Life Liberty National Division: Trust\u2011First Sales Ops With Reporting Discipline \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/index-named-accounts.html",
          "prettyPath": null,
          "file": "Case Studies/2026/index-named-accounts.html",
          "title": "Case Studies Library \u2014 Named Account Case Studies",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/index-ultimate-13.html",
          "prettyPath": null,
          "file": "Case Studies/2026/index-ultimate-13.html",
          "title": "Case Studies Library \u2014 Ultimate 13",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/index.html",
          "prettyPath": "/Case%20Studies/2026/",
          "file": "Case Studies/2026/index.html",
          "title": "Case Studies Library \u2014 Case Studies Library",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/instacart-marketplace-ops-high-velocity-fulfillment.html",
          "prettyPath": null,
          "file": "Case Studies/2026/instacart-marketplace-ops-high-velocity-fulfillment.html",
          "title": "Instacart: Marketplace Operations Enablement for High\u2011Velocity Fulfillment \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/invidia-healthcare-delivery-enablement-exception-control.html",
          "prettyPath": null,
          "file": "Case Studies/2026/invidia-healthcare-delivery-enablement-exception-control.html",
          "title": "Invidia: Healthcare Delivery Enablement With Exception Control \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/jitsu-delivery-route-intelligence-closeouts-exceptions.html",
          "prettyPath": null,
          "file": "Case Studies/2026/jitsu-delivery-route-intelligence-closeouts-exceptions.html",
          "title": "Jitsu Delivery: Route Intelligence, Closeouts, and Exception Control \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/one-point-patient-care-patient-focused-delivery-proof.html",
          "prettyPath": null,
          "file": "Case Studies/2026/one-point-patient-care-patient-focused-delivery-proof.html",
          "title": "One Point Patient Care: Patient\u2011Focused Delivery Operations With Proof Discipline \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/roadie-on-demand-delivery-partner-ops-enablement.html",
          "prettyPath": null,
          "file": "Case Studies/2026/roadie-on-demand-delivery-partner-ops-enablement.html",
          "title": "ROADIE: Partner Operations Enablement for On\u2011Demand Delivery Networks \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/uber-mobility-delivery-ops-structured-escalations.html",
          "prettyPath": null,
          "file": "Case Studies/2026/uber-mobility-delivery-ops-structured-escalations.html",
          "title": "Uber: Mobility & Delivery Operations Support With Structured Escalations \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/ultimate-ai-governance-ops-traceability-cost-control.html",
          "prettyPath": null,
          "file": "Case Studies/2026/ultimate-ai-governance-ops-traceability-cost-control.html",
          "title": "AI Governance + Ops: Traceability, Diagnostics, and Cost Control \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/ultimate-brand-ecosystem-multi-site-division-consistency.html",
          "prettyPath": null,
          "file": "Case Studies/2026/ultimate-brand-ecosystem-multi-site-division-consistency.html",
          "title": "Brand Ecosystem Build: Multi\u2011Site, Multi\u2011Division Navigation and Consistency \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/ultimate-confidentiality-first-marketing-premium-proof.html",
          "prettyPath": null,
          "file": "Case Studies/2026/ultimate-confidentiality-first-marketing-premium-proof.html",
          "title": "Confidentiality\u2011First Marketing System: Premium Proof Without Over\u2011Disclosure \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/ultimate-enterprise-lead-capture-intake-routing-platform.html",
          "prettyPath": null,
          "file": "Case Studies/2026/ultimate-enterprise-lead-capture-intake-routing-platform.html",
          "title": "Enterprise Lead Capture: Intake + Routing That Feels Like a Platform \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/ultimate-enterprise-trust-stack-operational-proof.html",
          "prettyPath": null,
          "file": "Case Studies/2026/ultimate-enterprise-trust-stack-operational-proof.html",
          "title": "Enterprise Trust Stack: From Brand Surface to Operational Proof \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/ultimate-finance-compliance-ops-documentation-discipline.html",
          "prettyPath": null,
          "file": "Case Studies/2026/ultimate-finance-compliance-ops-documentation-discipline.html",
          "title": "Finance + Compliance Operations: Documentation Discipline at Scale \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/ultimate-gig-workforce-orchestration-rapid-ramp.html",
          "prettyPath": null,
          "file": "Case Studies/2026/ultimate-gig-workforce-orchestration-rapid-ramp.html",
          "title": "Gig Workforce Orchestration: Staffing, Scheduling, and Rapid Ramp \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/ultimate-healthcare-last-mile-medication-delivery-statewide.html",
          "prettyPath": null,
          "file": "Case Studies/2026/ultimate-healthcare-last-mile-medication-delivery-statewide.html",
          "title": "Healthcare Last\u2011Mile: Medication Delivery Operations Across a State \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/ultimate-incident-readiness-exceptions-escalations-proof.html",
          "prettyPath": null,
          "file": "Case Studies/2026/ultimate-incident-readiness-exceptions-escalations-proof.html",
          "title": "Incident Readiness Program: Exceptions, Escalations, and Proof Artifacts \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/ultimate-insurance-sales-ops-trust-first-intake-reporting.html",
          "prettyPath": null,
          "file": "Case Studies/2026/ultimate-insurance-sales-ops-trust-first-intake-reporting.html",
          "title": "Insurance Sales Ops: Trust\u2011First Intake and Reporting at Scale \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/ultimate-marketplace-delivery-enablement-multi-partner.html",
          "prettyPath": null,
          "file": "Case Studies/2026/ultimate-marketplace-delivery-enablement-multi-partner.html",
          "title": "Marketplace Delivery Enablement: Multi\u2011Partner, Multi\u2011Lane Operations \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/ultimate-retail-delivery-high-volume-partner-integrations.html",
          "prettyPath": null,
          "file": "Case Studies/2026/ultimate-retail-delivery-high-volume-partner-integrations.html",
          "title": "Retail Delivery Programs: High\u2011Volume Consumer Logistics With Partner Integrations \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/ultimate-sales-delivery-unification-pipeline-to-production.html",
          "prettyPath": null,
          "file": "Case Studies/2026/ultimate-sales-delivery-unification-pipeline-to-production.html",
          "title": "Sales + Delivery Unification: From Pipeline to Production Without Drops \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/2026/workwhile-workforce-ramp-fast-staffing-programs.html",
          "prettyPath": null,
          "file": "Case Studies/2026/workwhile-workforce-ramp-fast-staffing-programs.html",
          "title": "WorkWhile: Workforce Ramp System for Fast Staffing Programs \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/404-navigation-repair-multi-page.html",
          "prettyPath": null,
          "file": "Case Studies/404-navigation-repair-multi-page.html",
          "title": "404 & Navigation Repair: Fixing Broken Multi-Page Deployments \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/accounting-bookkeeping-catch-up-project-plan.html",
          "prettyPath": null,
          "file": "Case Studies/accounting-bookkeeping-catch-up-project-plan.html",
          "title": "Bookkeeping Catch-Up System: Turning Backlog Into a Project Plan \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/accounting-client-portal-lite-status-clarity.html",
          "prettyPath": null,
          "file": "Case Studies/accounting-client-portal-lite-status-clarity.html",
          "title": "Client Portal Lite: \u2018Where Are We At?\u2019 Answered Instantly \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/accounting-executive-intake-pack-standard-attachments.html",
          "prettyPath": null,
          "file": "Case Studies/accounting-executive-intake-pack-standard-attachments.html",
          "title": "Executive Intake Pack: Standard Attachments That Make Clients Easier \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/accounting-monthly-close-ritual-system.html",
          "prettyPath": null,
          "file": "Case Studies/accounting-monthly-close-ritual-system.html",
          "title": "Monthly Close Ritual: A Simple System That Prevents Year-End Panic \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/accounting-payroll-onboarding-compliance-pack.html",
          "prettyPath": null,
          "file": "Case Studies/accounting-payroll-onboarding-compliance-pack.html",
          "title": "Payroll Onboarding Pack: Reducing Compliance Risk on Day One \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/accounting-service-menu-packaging-scope-control.html",
          "prettyPath": null,
          "file": "Case Studies/accounting-service-menu-packaging-scope-control.html",
          "title": "Accounting Service Menu: Packaging That Prevents Scope Creep \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/accounting-tax-document-vault-organized-inputs.html",
          "prettyPath": null,
          "file": "Case Studies/accounting-tax-document-vault-organized-inputs.html",
          "title": "Tax Document Vault: Making Filings Faster With Organized Inputs \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/ae-portal-contractor-sales-structure.html",
          "prettyPath": null,
          "file": "Case Studies/ae-portal-contractor-sales-structure.html",
          "title": "AE Portal: Contractor Sales System With Real Structure \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/ai-gateway-vendor-routing-governance.html",
          "prettyPath": null,
          "file": "Case Studies/ai-gateway-vendor-routing-governance.html",
          "title": "AI Gateway Concept: Vendor Routing With Governance \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/ai-saas-client-facing-model-naming-consistency.html",
          "prettyPath": null,
          "file": "Case Studies/ai-saas-client-facing-model-naming-consistency.html",
          "title": "AI App Suite Branding: Consistent Client-Facing Model Names \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/ai-saas-cost-guardrails-policy-gates.html",
          "prettyPath": null,
          "file": "Case Studies/ai-saas-cost-guardrails-policy-gates.html",
          "title": "AI Cost Guardrails: Preventing Runaway Usage With Policy Gates \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/ai-saas-kaixu-gateway-headers-diagnostics.html",
          "prettyPath": null,
          "file": "Case Studies/ai-saas-kaixu-gateway-headers-diagnostics.html",
          "title": "Kaixu Gateway Pattern: Standard Headers + Diagnostics for Traceability \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/ai-saas-offline-first-dispatch-vault-pattern.html",
          "prettyPath": null,
          "file": "Case Studies/ai-saas-offline-first-dispatch-vault-pattern.html",
          "title": "SkyeRoute Dispatch Vault Concept: Offline-First Workflow Pattern \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/ai-saas-prompt-library-reusable-excellence.html",
          "prettyPath": null,
          "file": "Case Studies/ai-saas-prompt-library-reusable-excellence.html",
          "title": "Prompt Library System: Reusable Excellence Instead of Random Inputs \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/ai-saas-seo-content-engine-publishing-pipeline.html",
          "prettyPath": null,
          "file": "Case Studies/ai-saas-seo-content-engine-publishing-pipeline.html",
          "title": "AI Content Engine: SEO Articles With a Real Publishing Pipeline \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/ai-saas-support-agent-escalation-blueprint.html",
          "prettyPath": null,
          "file": "Case Studies/ai-saas-support-agent-escalation-blueprint.html",
          "title": "AI Support Agent Blueprint: Escalation-First, Not Hallucination-First \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/ai-saas-valuation-reporter-feature-inventory.html",
          "prettyPath": null,
          "file": "Case Studies/ai-saas-valuation-reporter-feature-inventory.html",
          "title": "AI Valuation Reporter: Turning Feature Inventory Into a Sellable Document \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/barbershop-premium-visuals-local-seo.html",
          "prettyPath": null,
          "file": "Case Studies/barbershop-premium-visuals-local-seo.html",
          "title": "Barbershop: Premium Visuals + Local SEO That Actually Hits \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/case-study-collections-collapse/index.html",
          "prettyPath": "/Case%20Studies/case-study-collections-collapse/",
          "file": "Case Studies/case-study-collections-collapse/index.html",
          "title": "Case Study \u2014 Collections Collapse Recovery",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/case-study-home-occupation/index.html",
          "prettyPath": "/Case%20Studies/case-study-home-occupation/",
          "file": "Case Studies/case-study-home-occupation/index.html",
          "title": "Case Study \u2014 Home Occupation Clearance (Phoenix, AZ)",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/case-study-tpt-surprise/index.html",
          "prettyPath": "/Case%20Studies/case-study-tpt-surprise/",
          "file": "Case Studies/case-study-tpt-surprise/index.html",
          "title": "Case Study \u2014 Surprise, AZ TPT License & Compliance",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/contractor-portal-ae-sales-lead-stages-commissions.html",
          "prettyPath": null,
          "file": "Case Studies/contractor-portal-ae-sales-lead-stages-commissions.html",
          "title": "AE Sales Portal: Lead Stages + Commission Clarity \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/contractor-portal-onboarding-kit-sell-correctly.html",
          "prettyPath": null,
          "file": "Case Studies/contractor-portal-onboarding-kit-sell-correctly.html",
          "title": "Contractor Onboarding Kit: From \u2018Start Selling\u2019 to \u2018Sell Correctly\u2019 \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/contractor-portal-partner-referral-lane-trackable.html",
          "prettyPath": null,
          "file": "Case Studies/contractor-portal-partner-referral-lane-trackable.html",
          "title": "Partner Portal: Giving Referral Partners a Clean, Trackable Lane \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/directory-city-category-clusters-seo-scale.html",
          "prettyPath": null,
          "file": "Case Studies/directory-city-category-clusters-seo-scale.html",
          "title": "City Directory: Category Clusters That Make SEO Scale \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/directory-local-deals-convert-browsers-into-leads.html",
          "prettyPath": null,
          "file": "Case Studies/directory-local-deals-convert-browsers-into-leads.html",
          "title": "Local Deals Directory: Converting Browsers Into Leads \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/directory-microsites-one-city-many-niches.html",
          "prettyPath": null,
          "file": "Case Studies/directory-microsites-one-city-many-niches.html",
          "title": "Service Directory Microsites: One City, Many Niches, Same Standard \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/directory-vendor-vetting-workflow-premium.html",
          "prettyPath": null,
          "file": "Case Studies/directory-vendor-vetting-workflow-premium.html",
          "title": "Industry Directory: Vendor Vetting Workflow That Feels Premium \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/executive-filler-pro-free-high-value.html",
          "prettyPath": null,
          "file": "Case Studies/executive-filler-pro-free-high-value.html",
          "title": "Executive Filler Pro: Free High-Value Service That Creates Loyalty \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/family-hub-multi-page-trust-site.html",
          "prettyPath": null,
          "file": "Case Studies/family-hub-multi-page-trust-site.html",
          "title": "Family Hub: Multi-Page Trust Site for a Private Organization \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/freight-quote-navigator-quote-pipeline.html",
          "prettyPath": null,
          "file": "Case Studies/freight-quote-navigator-quote-pipeline.html",
          "title": "FreightQuoteNavigator: Turning Quote Requests into a Pipeline \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/index.html",
          "prettyPath": "/Case%20Studies/",
          "file": "Case Studies/index.html",
          "title": "Case Studies Index \u2014 SOLEnterprises",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/landing-page-factory-high-end-at-scale.html",
          "prettyPath": null,
          "file": "Case Studies/landing-page-factory-high-end-at-scale.html",
          "title": "Landing Page Factory: Deploying High-End Pages at Scale \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/local-contractor-instant-quote-qualification.html",
          "prettyPath": null,
          "file": "Case Studies/local-contractor-instant-quote-qualification.html",
          "title": "Local Contractor: Instant Quote System + Qualification \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/logistics-after-hours-quote-capture.html",
          "prettyPath": null,
          "file": "Case Studies/logistics-after-hours-quote-capture.html",
          "title": "After-Hours Quote Capture: No More \u2018We Missed You\u2019 \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/logistics-broker-compliance-trust-page.html",
          "prettyPath": null,
          "file": "Case Studies/logistics-broker-compliance-trust-page.html",
          "title": "Broker Compliance Page: Trust Signals That Reduce Friction \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/logistics-carrier-onboarding-compliance-intake.html",
          "prettyPath": null,
          "file": "Case Studies/logistics-carrier-onboarding-compliance-intake.html",
          "title": "Carrier Onboarding: A Clean Compliance Intake \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/logistics-dispatch-standard-load-intake.html",
          "prettyPath": null,
          "file": "Case Studies/logistics-dispatch-standard-load-intake.html",
          "title": "Dispatch Assist: Standardizing Load Intake for Faster Booking \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/logistics-freight-ops-dashboard-lightweight.html",
          "prettyPath": null,
          "file": "Case Studies/logistics-freight-ops-dashboard-lightweight.html",
          "title": "Freight Ops Dashboard Concept: Visibility Without a Heavy Platform \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/logistics-lane-intelligence-seo-to-quotes.html",
          "prettyPath": null,
          "file": "Case Studies/logistics-lane-intelligence-seo-to-quotes.html",
          "title": "Lane Intelligence Page: Turning Search Traffic Into Quote Requests \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/logistics-pod-collection-invoicing-workflow.html",
          "prettyPath": null,
          "file": "Case Studies/logistics-pod-collection-invoicing-workflow.html",
          "title": "POD Collection Workflow: Faster Invoicing Through Standardization \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/logistics-rate-confirmation-vault.html",
          "prettyPath": null,
          "file": "Case Studies/logistics-rate-confirmation-vault.html",
          "title": "Rate Confirmation Vault: Document Control for Brokers \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/nexus-connect-ecosystem-portal.html",
          "prettyPath": null,
          "file": "Case Studies/nexus-connect-ecosystem-portal.html",
          "title": "Nexus Connect: Turning a \u2018Company\u2019 Into an Ecosystem Portal \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/nonprofit-donation-volunteer-system.html",
          "prettyPath": null,
          "file": "Case Studies/nonprofit-donation-volunteer-system.html",
          "title": "Nonprofit: Donation + Volunteer System Without Tech Overhead \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/northstar-officexaccounting-executive-command.html",
          "prettyPath": null,
          "file": "Case Studies/northstar-officexaccounting-executive-command.html",
          "title": "NorthStar OfficeXAccounting: From Paper-Chaos to Executive Command \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/phoenix-attorney-pre-qualification-intake.html",
          "prettyPath": null,
          "file": "Case Studies/phoenix-attorney-pre-qualification-intake.html",
          "title": "Phoenix Attorney: Intake That Sorts Cases Before They Hit the Phone \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/phoenix-auto-detailer-booking-pipeline.html",
          "prettyPath": null,
          "file": "Case Studies/phoenix-auto-detailer-booking-pipeline.html",
          "title": "Phoenix Auto Detailer: Turning Walk-Ins Into a Predictable Booking Pipeline \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/phoenix-cleaning-recurring-membership.html",
          "prettyPath": null,
          "file": "Case Studies/phoenix-cleaning-recurring-membership.html",
          "title": "Phoenix Cleaning Service: Recurring Clients Through a Simple Membership Model \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/phoenix-fitness-coach-high-ticket-qualification.html",
          "prettyPath": null,
          "file": "Case Studies/phoenix-fitness-coach-high-ticket-qualification.html",
          "title": "Phoenix Fitness Coach: High-Ticket Leads With a Qualification Gate \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/phoenix-hvac-quote-intake-tech-ready.html",
          "prettyPath": null,
          "file": "Case Studies/phoenix-hvac-quote-intake-tech-ready.html",
          "title": "Phoenix HVAC: Quote Requests That Include What Techs Actually Need \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/phoenix-landscaping-seasonal-packages.html",
          "prettyPath": null,
          "file": "Case Studies/phoenix-landscaping-seasonal-packages.html",
          "title": "Phoenix Landscaping: Seasonal Packages + Lead Qualification \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/phoenix-med-spa-consultation-funnel.html",
          "prettyPath": null,
          "file": "Case Studies/phoenix-med-spa-consultation-funnel.html",
          "title": "Phoenix Med Spa: Consultation Funnel That Filters Low-Intent Inquiries \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/phoenix-mobile-notary-instant-scheduling.html",
          "prettyPath": null,
          "file": "Case Studies/phoenix-mobile-notary-instant-scheduling.html",
          "title": "Phoenix Mobile Notary: Instant Scheduling Without Back-and-Forth \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/phoenix-moving-quote-system-scope-control.html",
          "prettyPath": null,
          "file": "Case Studies/phoenix-moving-quote-system-scope-control.html",
          "title": "Phoenix Moving Company: Quote System That Prevents Surprise Pricing \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/phoenix-roofer-storm-lead-capture.html",
          "prettyPath": null,
          "file": "Case Studies/phoenix-roofer-storm-lead-capture.html",
          "title": "Phoenix Roofer: Storm-Season Lead Capture Without Phone Tag \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/proof-pack-offers-close-faster.html",
          "prettyPath": null,
          "file": "Case Studies/proof-pack-offers-close-faster.html",
          "title": "Service Business: \u2018Proof Pack\u2019 Offers That Close Faster \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/skyeleticx-league-governance-launch.html",
          "prettyPath": null,
          "file": "Case Studies/skyeleticx-league-governance-launch.html",
          "title": "SkyeLeticX: Launching a League With Real Governance \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/skyesol-brand-hub-holding-company.html",
          "prettyPath": null,
          "file": "Case Studies/skyesol-brand-hub-holding-company.html",
          "title": "SkyeSol: A Brand Hub That Feels Like a Holding Company \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/tattoo-studio-consultation-pipeline-portfolio.html",
          "prettyPath": null,
          "file": "Case Studies/tattoo-studio-consultation-pipeline-portfolio.html",
          "title": "Tattoo Studio: Consultation Pipeline + Portfolio Clarity \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/temp-agency-free-elite-build-converts.html",
          "prettyPath": null,
          "file": "Case Studies/temp-agency-free-elite-build-converts.html",
          "title": "Temp Agency Partner: Free Elite Build That Converts \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/The%20First%20Batch%20Proof%20Served.html",
          "prettyPath": null,
          "file": "Case Studies/The First Batch Proof Served.html",
          "title": "Case Studies Library \u2014 Batch 1",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/tire-shop-call-us-to-book-now.html",
          "prettyPath": null,
          "file": "Case Studies/tire-shop-call-us-to-book-now.html",
          "title": "Tire Shop: From \u2018Call Us\u2019 to \u2018Book Now\u2019 \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/valley-verified-trust-platform.html",
          "prettyPath": null,
          "file": "Case Studies/valley-verified-trust-platform.html",
          "title": "Valley Verified: Building a Trust Platform for Local Businesses \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        },
        {
          "urlPath": "/Case%20Studies/website-valuation-pack-sellable-assets.html",
          "prettyPath": null,
          "file": "Case Studies/website-valuation-pack-sellable-assets.html",
          "title": "Website Valuation Pack: Converting Sites Into Sellable Assets \u2014 Case Study",
          "ext": ".html",
          "category": "Case Studies"
        }
      ]
    },
    {
      "name": "case-study-collections-collapse",
      "count": 1,
      "items": [
        {
          "urlPath": "/case-study-collections-collapse/index.html",
          "prettyPath": "/case-study-collections-collapse/",
          "file": "case-study-collections-collapse/index.html",
          "title": "Case study placeholder",
          "ext": ".html",
          "category": "case-study-collections-collapse"
        }
      ]
    },
    {
      "name": "case-study-home-occupation",
      "count": 1,
      "items": [
        {
          "urlPath": "/case-study-home-occupation/index.html",
          "prettyPath": "/case-study-home-occupation/",
          "file": "case-study-home-occupation/index.html",
          "title": "Case study placeholder",
          "ext": ".html",
          "category": "case-study-home-occupation"
        }
      ]
    },
    {
      "name": "case-study-tpt-surprise",
      "count": 1,
      "items": [
        {
          "urlPath": "/case-study-tpt-surprise/index.html",
          "prettyPath": "/case-study-tpt-surprise/",
          "file": "case-study-tpt-surprise/index.html",
          "title": "Case study placeholder",
          "ext": ".html",
          "category": "case-study-tpt-surprise"
        }
      ]
    },
    {
      "name": "contact",
      "count": 1,
      "items": [
        {
          "urlPath": "/contact/index.html",
          "prettyPath": "/contact/",
          "file": "contact/index.html",
          "title": "Contact \u2014 Skyes Over London LC",
          "ext": ".html",
          "category": "contact"
        }
      ]
    },
    {
      "name": "credibility",
      "count": 1,
      "items": [
        {
          "urlPath": "/credibility/index.html",
          "prettyPath": "/credibility/",
          "file": "credibility/index.html",
          "title": "Credibility Archive \u2014 Skyes Over London LC",
          "ext": ".html",
          "category": "credibility"
        }
      ]
    },
    {
      "name": "css",
      "count": 2,
      "items": [
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "css/sol-intro.css",
          "title": null,
          "ext": ".css",
          "category": "css"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "css/style.css",
          "title": null,
          "ext": ".css",
          "category": "css"
        }
      ]
    },
    {
      "name": "directory",
      "count": 1,
      "items": [
        {
          "urlPath": "/directory/index.html",
          "prettyPath": "/directory/",
          "file": "directory/index.html",
          "title": "Directory | SOL",
          "ext": ".html",
          "category": "directory"
        }
      ]
    },
    {
      "name": "divisions",
      "count": 1,
      "items": [
        {
          "urlPath": "/divisions/index.html",
          "prettyPath": "/divisions/",
          "file": "divisions/index.html",
          "title": "Divisions | SOL",
          "ext": ".html",
          "category": "divisions"
        }
      ]
    },
    {
      "name": "gateway",
      "count": 11,
      "items": [
        {
          "urlPath": "/gateway/dashboard.html",
          "prettyPath": null,
          "file": "gateway/dashboard.html",
          "title": "Kaixu Gateway Dashboard",
          "ext": ".html",
          "category": "gateway"
        },
        {
          "urlPath": "/gateway/gate-proofx.html",
          "prettyPath": null,
          "file": "gateway/gate-proofx.html",
          "title": "Gate Proofx",
          "ext": ".html",
          "category": "gateway"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "gateway/assets/app.js",
          "title": null,
          "ext": ".js",
          "category": "gateway"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "gateway/assets/kaixu-client.js",
          "title": null,
          "ext": ".js",
          "category": "gateway"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "gateway/assets/style.css",
          "title": null,
          "ext": ".css",
          "category": "gateway"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "gateway/assets/user.js",
          "title": null,
          "ext": ".js",
          "category": "gateway"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "gateway/examples/auto-client.js",
          "title": null,
          "ext": ".js",
          "category": "gateway"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "gateway/examples/client-error-reporter.js",
          "title": null,
          "ext": ".js",
          "category": "gateway"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "gateway/examples/job-client.js",
          "title": null,
          "ext": ".js",
          "category": "gateway"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "gateway/examples/sse-client.js",
          "title": null,
          "ext": ".js",
          "category": "gateway"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "gateway/pricing/pricing.json",
          "title": null,
          "ext": ".json",
          "category": "gateway"
        }
      ]
    },
    {
      "name": "get-started",
      "count": 1,
      "items": [
        {
          "urlPath": "/get-started/index.html",
          "prettyPath": "/get-started/",
          "file": "get-started/index.html",
          "title": "Get Started | SOL",
          "ext": ".html",
          "category": "get-started"
        }
      ]
    },
    {
      "name": "how-to-get-an-ein-arizona",
      "count": 1,
      "items": [
        {
          "urlPath": "/how-to-get-an-ein-arizona/index.html",
          "prettyPath": "/how-to-get-an-ein-arizona/",
          "file": "how-to-get-an-ein-arizona/index.html",
          "title": null,
          "ext": ".html",
          "category": "how-to-get-an-ein-arizona"
        }
      ]
    },
    {
      "name": "how-to-start-an-llc-in-arizona-phoenix",
      "count": 1,
      "items": [
        {
          "urlPath": "/how-to-start-an-llc-in-arizona-phoenix/index.html",
          "prettyPath": "/how-to-start-an-llc-in-arizona-phoenix/",
          "file": "how-to-start-an-llc-in-arizona-phoenix/index.html",
          "title": null,
          "ext": ".html",
          "category": "how-to-start-an-llc-in-arizona-phoenix"
        }
      ]
    },
    {
      "name": "index",
      "count": 1,
      "items": [
        {
          "urlPath": "/index/index.html",
          "prettyPath": "/index/",
          "file": "index/index.html",
          "title": "Skyes Over London LC \u2014 SOLEnterprises Ecosystem",
          "ext": ".html",
          "category": "index"
        }
      ]
    },
    {
      "name": "js",
      "count": 7,
      "items": [
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "js/admin-menu-triggers.js",
          "title": null,
          "ext": ".js",
          "category": "js"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "js/growth.js",
          "title": null,
          "ext": ".js",
          "category": "js"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "js/main.js",
          "title": null,
          "ext": ".js",
          "category": "js"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "js/netlify-identity-init.js",
          "title": null,
          "ext": ".js",
          "category": "js"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "js/partials.js",
          "title": null,
          "ext": ".js",
          "category": "js"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "js/sol-intro.js",
          "title": null,
          "ext": ".js",
          "category": "js"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "js/three-bg.js",
          "title": null,
          "ext": ".js",
          "category": "js"
        }
      ]
    },
    {
      "name": "kAIxu",
      "count": 2,
      "items": [
        {
          "urlPath": "/kAIxu/index.html",
          "prettyPath": "/kAIxu/",
          "file": "kAIxu/index.html",
          "title": null,
          "ext": ".html",
          "category": "kAIxu"
        },
        {
          "urlPath": "/kAIxu/RequestKaixuAPIKey.html",
          "prettyPath": null,
          "file": "kAIxu/RequestKaixuAPIKey.html",
          "title": null,
          "ext": ".html",
          "category": "kAIxu"
        }
      ]
    },
    {
      "name": "leadership",
      "count": 3,
      "items": [
        {
          "urlPath": "/leadership/dakayla-clark.html",
          "prettyPath": null,
          "file": "leadership/dakayla-clark.html",
          "title": "Dakayla Clark - Vice President | SOL",
          "ext": ".html",
          "category": "leadership"
        },
        {
          "urlPath": "/leadership/index.html",
          "prettyPath": "/leadership/",
          "file": "leadership/index.html",
          "title": "Leadership | SOL",
          "ext": ".html",
          "category": "leadership"
        },
        {
          "urlPath": "/leadership/SkyesOverLondon.html",
          "prettyPath": null,
          "file": "leadership/SkyesOverLondon.html",
          "title": "Skyes Over London - Operator Profile | SOL",
          "ext": ".html",
          "category": "leadership"
        }
      ]
    },
    {
      "name": "network",
      "count": 1,
      "items": [
        {
          "urlPath": "/network/index.html",
          "prettyPath": "/network/",
          "file": "network/index.html",
          "title": "SOLE Network \u2014 SOLEnterprises Ecosystem",
          "ext": ".html",
          "category": "network"
        }
      ]
    },
    {
      "name": "Pages",
      "count": 1,
      "items": [
        {
          "urlPath": "/Pages/Services.html",
          "prettyPath": null,
          "file": "Pages/Services.html",
          "title": "Services placeholder page",
          "ext": ".html",
          "category": "Pages"
        }
      ]
    },
    {
      "name": "partials",
      "count": 2,
      "items": [
        {
          "urlPath": "/partials/footer.html",
          "prettyPath": null,
          "file": "partials/footer.html",
          "title": null,
          "ext": ".html",
          "category": "partials"
        },
        {
          "urlPath": "/partials/header.html",
          "prettyPath": null,
          "file": "partials/header.html",
          "title": null,
          "ext": ".html",
          "category": "partials"
        }
      ]
    },
    {
      "name": "phoenix-business-license-requirements",
      "count": 1,
      "items": [
        {
          "urlPath": "/phoenix-business-license-requirements/index.html",
          "prettyPath": "/phoenix-business-license-requirements/",
          "file": "phoenix-business-license-requirements/index.html",
          "title": null,
          "ext": ".html",
          "category": "phoenix-business-license-requirements"
        }
      ]
    },
    {
      "name": "phoenix-start-business-llc-compliance-playbook",
      "count": 1,
      "items": [
        {
          "urlPath": "/phoenix-start-business-llc-compliance-playbook/index.html",
          "prettyPath": "/phoenix-start-business-llc-compliance-playbook/",
          "file": "phoenix-start-business-llc-compliance-playbook/index.html",
          "title": null,
          "ext": ".html",
          "category": "phoenix-start-business-llc-compliance-playbook"
        }
      ]
    },
    {
      "name": "platforms",
      "count": 1,
      "items": [
        {
          "urlPath": "/platforms/index.html",
          "prettyPath": "/platforms/",
          "file": "platforms/index.html",
          "title": "Kaixu Platforms \u2014 SOLEnterprises AI Division",
          "ext": ".html",
          "category": "platforms"
        }
      ]
    },
    {
      "name": "Platforms-Apps-Infrastructure",
      "count": 202,
      "items": [
        {
          "urlPath": "/Platforms-Apps-Infrastructure/BrandID-Offline-PWA/index.html",
          "prettyPath": "/Platforms-Apps-Infrastructure/BrandID-Offline-PWA/",
          "file": "Platforms-Apps-Infrastructure/BrandID-Offline-PWA/index.html",
          "title": "Skyes Over London | Brand Identity Kit",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/BusinessLaunchGo/index.html",
          "prettyPath": "/Platforms-Apps-Infrastructure/BusinessLaunchGo/",
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/index.html",
          "title": "Business Launch Kit (AZ) Pack",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/DualLaneFunnel/public/diagnostics.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/public/diagnostics.html",
          "title": "Diagnostics \u2022 Skyes Over London",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/DualLaneFunnel/public/employers.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/public/employers.html",
          "title": "Employers \u2022 Skyes Over London",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/DualLaneFunnel/public/funnel-system-editorial.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/public/funnel-system-editorial.html",
          "title": "Skyes Over London \u2022 Dual\u2011Lane Funnel System (Job Seekers + Employers) | Skyes Over London LC",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/DualLaneFunnel/public/index.html",
          "prettyPath": "/Platforms-Apps-Infrastructure/DualLaneFunnel/public/",
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/public/index.html",
          "title": "Skyes Over London \u2022 Dual\u2011Lane Agency Funnel",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/DualLaneFunnel/public/jobseekers.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/public/jobseekers.html",
          "title": "Job Seekers \u2022 Skyes Over London",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/DualLaneFunnel/public/privacy.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/public/privacy.html",
          "title": "Privacy \u2022 Skyes Over London",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/DualLaneFunnel/public/terms.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/public/terms.html",
          "title": "Terms \u2022 Skyes Over London",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/DualLaneFunnel/public/thank-you.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/public/thank-you.html",
          "title": "Submitted \u2022 Skyes Over London",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/GateProofx/index.html",
          "prettyPath": "/Platforms-Apps-Infrastructure/GateProofx/",
          "file": "Platforms-Apps-Infrastructure/GateProofx/index.html",
          "title": "Gate Proofx \xB7 Gateway Data Explorer",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/JWTSecretGenerator.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/JWTSecretGenerator.html",
          "title": "JWT Secret Generator",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/kAIxUBrandKit/index.html",
          "prettyPath": "/Platforms-Apps-Infrastructure/kAIxUBrandKit/",
          "file": "Platforms-Apps-Infrastructure/kAIxUBrandKit/index.html",
          "title": "Skyes Over London | Brand Kit + kAIxU",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/kAIxUCHat/kAIxUchat.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUCHat/kAIxUchat.html",
          "title": null,
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/kAIxUGateway13/dashboard.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/dashboard.html",
          "title": "Kaixu Gateway Dashboard",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/kAIxUGateway13/gate-proofx.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/gate-proofx.html",
          "title": "Gate Proofx",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/kAIxUGateway13/index.html",
          "prettyPath": "/Platforms-Apps-Infrastructure/kAIxUGateway13/",
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/index.html",
          "title": "Kaixu Gateway Admin",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/kAIxUGateway13/intro.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/intro.html",
          "title": "kAIxU Gateway 13 Intro",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/kAIxUGateway13/smoketest.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/smoketest.html",
          "title": "Kaixu Gateway 13 \u2014 Smoke Tests | Skyes Over London LC",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/LocalSeoSnapshot/404.html",
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/LocalSeoSnapshot/404.html",
          "title": "Redirecting\u2026",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": "/Platforms-Apps-Infrastructure/LocalSeoSnapshot/index.html",
          "prettyPath": "/Platforms-Apps-Infrastructure/LocalSeoSnapshot/",
          "file": "Platforms-Apps-Infrastructure/LocalSeoSnapshot/index.html",
          "title": "Local SEO Snapshot \u2014 Skyes Over London LC",
          "ext": ".html",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BrandID-Offline-PWA/assets/icon-512.png",
          "title": null,
          "ext": ".png",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BrandID-Offline-PWA/assets/logo.svg",
          "title": null,
          "ext": ".svg",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BrandID-Offline-PWA/icon-192.png",
          "title": null,
          "ext": ".png",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BrandID-Offline-PWA/icons/logo.png",
          "title": null,
          "ext": ".png",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BrandID-Offline-PWA/manifest.webmanifest",
          "title": null,
          "ext": ".webmanifest",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BrandID-Offline-PWA/sw.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/assets/app.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/assets/icon-192.png",
          "title": null,
          "ext": ".png",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/assets/icon-512.png",
          "title": null,
          "ext": ".png",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/assets/logo.png",
          "title": null,
          "ext": ".png",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/assets/svs.css",
          "title": null,
          "ext": ".css",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/assets/zip.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/manifest.webmanifest",
          "title": null,
          "ext": ".webmanifest",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/netlify.toml",
          "title": null,
          "ext": ".toml",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/netlify/functions/blob-store-pack.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/netlify/functions/client-error-report.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/netlify/functions/neon-health.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/netlify/functions/neon-lead-upsert.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/README.md",
          "title": null,
          "ext": ".md",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/schema.sql",
          "title": null,
          "ext": ".sql",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/BusinessLaunchGo/sw.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/netlify.toml",
          "title": null,
          "ext": ".toml",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/netlify/functions/health.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/netlify/functions/intake.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/package-lock.json",
          "title": null,
          "ext": ".json",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/package.json",
          "title": null,
          "ext": ".json",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/public/assets/dual_lane_funnel_system_brief.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/public/assets/dual_lane_funnel_valuation_certificate.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/public/assets/funnel_diagram.png",
          "title": null,
          "ext": ".png",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/public/assets/intake.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/public/assets/style.css",
          "title": null,
          "ext": ".css",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/README_DEPLOY.md",
          "title": null,
          "ext": ".md",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/DualLaneFunnel/README.md",
          "title": null,
          "ext": ".md",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/GateProofx/app.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/GateProofx/DevNotes",
          "title": null,
          "ext": "",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/GateProofx/style.css",
          "title": null,
          "ext": ".css",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUBrandKit/netlify.toml",
          "title": null,
          "ext": ".toml",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUBrandKit/netlify/functions/client-error-report.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUBrandKit/netlify/functions/kaixu-generate.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUBrandKit/package.json",
          "title": null,
          "ext": ".json",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUBrandKit/README.md",
          "title": null,
          "ext": ".md",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUBrandKit/SkyesOverLondon_kAIxU_Build_Report_and_Valuation.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUBrandKit/SkyesOverLondon_kAIxU_BuildReport_Valuation_DETAILED.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/assets/app.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/assets/kaixu-client.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/assets/style.css",
          "title": null,
          "ext": ".css",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/assets/user.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/deno.lock",
          "title": null,
          "ext": ".lock",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/docs/RUNBOOK_CLIENT_APPS.md",
          "title": null,
          "ext": ".md",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/docs/RUNBOOK_GITHUB_PUSH.md",
          "title": null,
          "ext": ".md",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/docs/RUNBOOK_NETLIFY_PUSH.md",
          "title": null,
          "ext": ".md",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/env.template",
          "title": null,
          "ext": ".template",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/examples/auto-client.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/examples/client-error-reporter.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/examples/job-client.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/examples/sse-client.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/kAIxuGateway13_integrationDirective (5).txt",
          "title": null,
          "ext": ".txt",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify.toml",
          "title": null,
          "ext": ".toml",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/admin.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/alerts.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/allowlist.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/audit.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/authz.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/crypto.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/csv.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/db.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/devices.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/github.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/githubTokens.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/http.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/invoices.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/kaixu.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/monitor.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/netlifyTokens.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/pricing.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/providers.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/pushCaps.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/pushNetlify.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/pushPath.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/pushPathNormalize.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/ratelimit.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/twilio.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/voice_pricing.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/voice.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/wrap.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-customers.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-devices.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-export.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-gh-jobs.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-github-repos.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-github-token.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-invoices.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-keys.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-login.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-monitor-events.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-monitor-prune.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-monitor-stream.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-netlify-token.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-push-deploys.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-push-invoices.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-push-jobs.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-push-projects.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-topup.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-usage.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-voice-numbers.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/admin-voice-usage.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/asyncjobs-retention.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/client-error-report.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gateway-chat.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gateway-job-result.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gateway-job-run-background.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gateway-job-status.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gateway-job-submit.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gateway-stream.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gh-chunk-cleanup.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gh-job-retry.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gh-my-jobs.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gh-push-background.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gh-push-init.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gh-push-status.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gh-push-upload-chunk.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/gh-push-upload-complete.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/github-create-repo.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/github-oauth-callback.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/github-oauth-start.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/github-repos.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/github-token.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/github-whoami.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/health.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/monitor-archive-access.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/monitor-archive-prune.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-billing.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-chunk-cleanup.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-complete-background.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-complete.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-file-status.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-init.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-job-retry.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-projects.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-status.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-upload-chunk.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-upload-complete.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-upload.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-uploadfile-background.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/push-whoami.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/session-token.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/stripe-create-checkout.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/stripe-webhook.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/user-devices.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/user-events.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/user-export.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/user-invoices.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/user-summary.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/user-topup-checkout.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/user-voice-calls.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/user-voice-summary.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/voice-twilio-inbound.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/voice-twilio-status.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/voice-twilio-turn.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/package-lock.json",
          "title": null,
          "ext": ".json",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/package.json",
          "title": null,
          "ext": ".json",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/pricing/pricing.json",
          "title": null,
          "ext": ".json",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/readme.md",
          "title": null,
          "ext": ".md",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/scripts/deploy.ps1",
          "title": null,
          "ext": ".ps1",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/scripts/deploy.sh",
          "title": null,
          "ext": ".sh",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/scripts/e2e-local.mjs",
          "title": null,
          "ext": ".mjs",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/scripts/fix-env.mjs",
          "title": null,
          "ext": ".mjs",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/scripts/smoke-gemini.sh",
          "title": null,
          "ext": ".sh",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/sql/migrate_v1_to_v2.sql",
          "title": null,
          "ext": ".sql",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/sql/migrate_v2_to_v5.sql",
          "title": null,
          "ext": ".sql",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/kAIxUGateway13/sql/schema_v2.sql",
          "title": null,
          "ext": ".sql",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/LocalSeoSnapshot/app.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/LocalSeoSnapshot/icons/icon-192.svg",
          "title": null,
          "ext": ".svg",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/LocalSeoSnapshot/icons/icon-512.svg",
          "title": null,
          "ext": ".svg",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/LocalSeoSnapshot/manifest.webmanifest",
          "title": null,
          "ext": ".webmanifest",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/LocalSeoSnapshot/netlify.toml",
          "title": null,
          "ext": ".toml",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/LocalSeoSnapshot/netlify/functions/client-error-report.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/LocalSeoSnapshot/readme.md",
          "title": null,
          "ext": ".md",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/LocalSeoSnapshot/robots.txt",
          "title": null,
          "ext": ".txt",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/LocalSeoSnapshot/styles.css",
          "title": null,
          "ext": ".css",
          "category": "Platforms-Apps-Infrastructure"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Platforms-Apps-Infrastructure/LocalSeoSnapshot/sw.js",
          "title": null,
          "ext": ".js",
          "category": "Platforms-Apps-Infrastructure"
        }
      ]
    },
    {
      "name": "pricing",
      "count": 1,
      "items": [
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "pricing/pricing.json",
          "title": null,
          "ext": ".json",
          "category": "pricing"
        }
      ]
    },
    {
      "name": "privacy",
      "count": 1,
      "items": [
        {
          "urlPath": "/privacy/index.html",
          "prettyPath": "/privacy/",
          "file": "privacy/index.html",
          "title": "Privacy \xB7 Skyes Over London LC",
          "ext": ".html",
          "category": "privacy"
        }
      ]
    },
    {
      "name": "reports",
      "count": 1,
      "items": [
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "reports/internal-link-audit.json",
          "title": null,
          "ext": ".json",
          "category": "reports"
        }
      ]
    },
    {
      "name": "resources",
      "count": 1,
      "items": [
        {
          "urlPath": "/resources/phoenix-business-resource-directory/index.html",
          "prettyPath": "/resources/phoenix-business-resource-directory/",
          "file": "resources/phoenix-business-resource-directory/index.html",
          "title": "Phoenix Business Resource Directory",
          "ext": ".html",
          "category": "resources"
        }
      ]
    },
    {
      "name": "scripts",
      "count": 7,
      "items": [
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "scripts/audit-internal-links.mjs",
          "title": null,
          "ext": ".mjs",
          "category": "scripts"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "scripts/generate-site-menu.mjs",
          "title": null,
          "ext": ".mjs",
          "category": "scripts"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "scripts/generate-sitemap.js",
          "title": null,
          "ext": ".js",
          "category": "scripts"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "scripts/link-guardian.js",
          "title": null,
          "ext": ".js",
          "category": "scripts"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "scripts/meta-templater.js",
          "title": null,
          "ext": ".js",
          "category": "scripts"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "scripts/sync-blogs-manifest.js",
          "title": null,
          "ext": ".js",
          "category": "scripts"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "scripts/sync-case-studies-index.js",
          "title": null,
          "ext": ".js",
          "category": "scripts"
        }
      ]
    },
    {
      "name": "Services",
      "count": 39,
      "items": [
        {
          "urlPath": "/Services/ai-data-apps.html",
          "prettyPath": null,
          "file": "Services/ai-data-apps.html",
          "title": "DataPilot\u2122 \u2014 AI Data App Productization",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/ai-data-apps/index.html",
          "prettyPath": "/Services/ai-data-apps/",
          "file": "Services/ai-data-apps/index.html",
          "title": "DataPilot\u2122 \u2014 AI Data App Productization",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/analytics-dashboards.html",
          "prettyPath": null,
          "file": "Services/analytics-dashboards.html",
          "title": "Analytics & BI Dashboards \u2014 InsightForge\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/analytics-dashboards/index.html",
          "prettyPath": "/Services/analytics-dashboards/",
          "file": "Services/analytics-dashboards/index.html",
          "title": "Analytics & BI Dashboards \u2014 InsightForge\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/api-integration.html",
          "prettyPath": null,
          "file": "Services/api-integration.html",
          "title": "API & Integration Layer \u2014 ConnectBridge\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/api-integration/index.html",
          "prettyPath": "/Services/api-integration/",
          "file": "Services/api-integration/index.html",
          "title": "API & Integration Layer \u2014 ConnectBridge\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/brand-identity.html",
          "prettyPath": null,
          "file": "Services/brand-identity.html",
          "title": "Brand Identity & Design Systems \u2014 BrandForge\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/brand-identity/index.html",
          "prettyPath": "/Services/brand-identity/",
          "file": "Services/brand-identity/index.html",
          "title": "Brand Identity & Design Systems \u2014 BrandForge\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/docs-knowledge.html",
          "prettyPath": null,
          "file": "Services/docs-knowledge.html",
          "title": "Documentation & Knowledge Base \u2014 VaultOps\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/docs-knowledge/index.html",
          "prettyPath": "/Services/docs-knowledge/",
          "file": "Services/docs-knowledge/index.html",
          "title": "Documentation & Knowledge Base \u2014 VaultOps\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/ecommerce-payments.html",
          "prettyPath": null,
          "file": "Services/ecommerce-payments.html",
          "title": "CheckoutForge\u2122 \u2014 Ecommerce & Payments Productization",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/ecommerce-payments/index.html",
          "prettyPath": "/Services/ecommerce-payments/",
          "file": "Services/ecommerce-payments/index.html",
          "title": "CheckoutForge\u2122 \u2014 Ecommerce & Payments Productization",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/intake-routing.html",
          "prettyPath": null,
          "file": "Services/intake-routing.html",
          "title": "Intake & Routing \u2014 Queues and Handoffs",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/intake-routing/index.html",
          "prettyPath": "/Services/intake-routing/",
          "file": "Services/intake-routing/index.html",
          "title": "Intake & Routing \u2014 Queues and Handoffs",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/lifecycle-retention.html",
          "prettyPath": null,
          "file": "Services/lifecycle-retention.html",
          "title": "Lifecycle & Retention Systems \u2014 RetainEngine\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/lifecycle-retention/index.html",
          "prettyPath": "/Services/lifecycle-retention/",
          "file": "Services/lifecycle-retention/index.html",
          "title": "Lifecycle & Retention Systems \u2014 RetainEngine\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/mvp-launchpad.html",
          "prettyPath": null,
          "file": "Services/mvp-launchpad.html",
          "title": "MVP & Proof-of-Concept Builds \u2014 LaunchPad\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/mvp-launchpad/index.html",
          "prettyPath": "/Services/mvp-launchpad/",
          "file": "Services/mvp-launchpad/index.html",
          "title": "MVP & Proof-of-Concept Builds \u2014 LaunchPad\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/notification-comms.html",
          "prettyPath": null,
          "file": "Services/notification-comms.html",
          "title": "Notification & Communication Orchestration \u2014 PulseWire\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/notification-comms/index.html",
          "prettyPath": "/Services/notification-comms/",
          "file": "Services/notification-comms/index.html",
          "title": "Notification & Communication Orchestration \u2014 PulseWire\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/platform-migration.html",
          "prettyPath": null,
          "file": "Services/platform-migration.html",
          "title": "Platform Migration & Modernization \u2014 MigrateOps\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/platform-migration/index.html",
          "prettyPath": "/Services/platform-migration/",
          "file": "Services/platform-migration/index.html",
          "title": "Platform Migration & Modernization \u2014 MigrateOps\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/portals-hubs.html",
          "prettyPath": null,
          "file": "Services/portals-hubs.html",
          "title": "AccessAtlas\u2122 \u2014 Portals & Hubs Productization",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/portals-hubs/index.html",
          "prettyPath": "/Services/portals-hubs/",
          "file": "Services/portals-hubs/index.html",
          "title": "AccessAtlas\u2122 \u2014 Portals & Hubs Productization",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/security-audit.html",
          "prettyPath": null,
          "file": "Services/security-audit.html",
          "title": "Security Audit & Hardening \u2014 ShieldStack\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/security-audit/index.html",
          "prettyPath": "/Services/security-audit/",
          "file": "Services/security-audit/index.html",
          "title": "Security Audit & Hardening \u2014 ShieldStack\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/seo-content.html",
          "prettyPath": null,
          "file": "Services/seo-content.html",
          "title": "SEO & Content Infrastructure \u2014 ContentEngine\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/seo-content/index.html",
          "prettyPath": "/Services/seo-content/",
          "file": "Services/seo-content/index.html",
          "title": "SEO & Content Infrastructure \u2014 ContentEngine\u2122",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/SkyePWAForge/SkyePWAForge.html",
          "prettyPath": null,
          "file": "Services/SkyePWAForge/SkyePWAForge.html",
          "title": "PWA Conversion \u2014 SkyePWA Forge\u2122 (Website-as-App)",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/TEMPLATE.html",
          "prettyPath": null,
          "file": "Services/TEMPLATE.html",
          "title": "Intake & Routing \u2014 Queues and Handoffs",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/trust-surfaces.html",
          "prettyPath": null,
          "file": "Services/trust-surfaces.html",
          "title": "Trust Surfaces \u2014 Status, Privacy, Terms",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/trust-surfaces/index.html",
          "prettyPath": "/Services/trust-surfaces/",
          "file": "Services/trust-surfaces/index.html",
          "title": "Trust Surfaces \u2014 Status, Privacy, Terms",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/WebBuilds.html",
          "prettyPath": null,
          "file": "Services/WebBuilds.html",
          "title": "CineFrame\u2122 \u2014 Cinematic Web Productization",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": "/Services/WebBuilds/index.html",
          "prettyPath": "/Services/WebBuilds/",
          "file": "Services/WebBuilds/index.html",
          "title": "CineFrame\u2122 \u2014 Cinematic Web Productization",
          "ext": ".html",
          "category": "Services"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Services/DualLaneFunnel/Skyes_Over_London_Dual_Lane_Funnel_System_Branded.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Services"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Services/DualLaneFunnel/Skyes_Over_London_Funnel_Valuation_Branded.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Services"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Services/for this dumbass ai",
          "title": null,
          "ext": "",
          "category": "Services"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Services/IDEAS",
          "title": null,
          "ext": "",
          "category": "Services"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Services/SkyePWAForge/SOL_SkyePWA_Forge_Flyer.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Services"
        }
      ]
    },
    {
      "name": "SkyeArchive",
      "count": 1,
      "items": [
        {
          "urlPath": "/SkyeArchive/index.html",
          "prettyPath": "/SkyeArchive/",
          "file": "SkyeArchive/index.html",
          "title": "SkyeArchive | Compliance Vault",
          "ext": ".html",
          "category": "SkyeArchive"
        }
      ]
    },
    {
      "name": "SkyeCollab",
      "count": 1,
      "items": [
        {
          "urlPath": "/SkyeCollab/index.html",
          "prettyPath": "/SkyeCollab/",
          "file": "SkyeCollab/index.html",
          "title": "SkyeCollab | Lockstep Studio",
          "ext": ".html",
          "category": "SkyeCollab"
        }
      ]
    },
    {
      "name": "SkyeDocx",
      "count": 26,
      "items": [
        {
          "urlPath": "/SkyeDocx/homepage.html",
          "prettyPath": null,
          "file": "SkyeDocx/homepage.html",
          "title": "Skye DocX \u2014 Offline Document Environment",
          "ext": ".html",
          "category": "SkyeDocx"
        },
        {
          "urlPath": "/SkyeDocx/index.html",
          "prettyPath": "/SkyeDocx/",
          "file": "SkyeDocx/index.html",
          "title": "Skye DocX | Professional Environment",
          "ext": ".html",
          "category": "SkyeDocx"
        },
        {
          "urlPath": "/SkyeDocx/offline.html",
          "prettyPath": null,
          "file": "SkyeDocx/offline.html",
          "title": "Skye DocX | Offline",
          "ext": ".html",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/apple-touch-icon.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/brand/icon-192.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/brand/icon-512.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/brand/sol_tiger.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/brand/untitled-design-35.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/favicon-16.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/favicon-32.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/icon-128.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/icon-144.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/icon-152.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/icon-192-maskable.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/icon-192.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/icon-384.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/icon-512-maskable.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/icon-512.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/icon-72.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/assets/icons/icon-96.png",
          "title": null,
          "ext": ".png",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/manifest.json",
          "title": null,
          "ext": ".json",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/manifest.webmanifest",
          "title": null,
          "ext": ".webmanifest",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/netlify.toml",
          "title": null,
          "ext": ".toml",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/readme.txt",
          "title": null,
          "ext": ".txt",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/service-worker.js",
          "title": null,
          "ext": ".js",
          "category": "SkyeDocx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyeDocx/sw.js",
          "title": null,
          "ext": ".js",
          "category": "SkyeDocx"
        }
      ]
    },
    {
      "name": "SkyeDrive",
      "count": 1,
      "items": [
        {
          "urlPath": "/SkyeDrive/index.html",
          "prettyPath": "/SkyeDrive/",
          "file": "SkyeDrive/index.html",
          "title": "SkyeDrive | Fortune 500 Vault",
          "ext": ".html",
          "category": "SkyeDrive"
        }
      ]
    },
    {
      "name": "SkyeFlow",
      "count": 1,
      "items": [
        {
          "urlPath": "/SkyeFlow/index.html",
          "prettyPath": "/SkyeFlow/",
          "file": "SkyeFlow/index.html",
          "title": "SkyeFlow | Automation Hub",
          "ext": ".html",
          "category": "SkyeFlow"
        }
      ]
    },
    {
      "name": "SkyeLedger",
      "count": 1,
      "items": [
        {
          "urlPath": "/SkyeLedger/index.html",
          "prettyPath": "/SkyeLedger/",
          "file": "SkyeLedger/index.html",
          "title": "SkyeLedger | Executive Intelligence Cockpit",
          "ext": ".html",
          "category": "SkyeLedger"
        }
      ]
    },
    {
      "name": "SkyeOps",
      "count": 1,
      "items": [
        {
          "urlPath": "/SkyeOps/index.html",
          "prettyPath": "/SkyeOps/",
          "file": "SkyeOps/index.html",
          "title": "SkyeOps | Mission Control",
          "ext": ".html",
          "category": "SkyeOps"
        }
      ]
    },
    {
      "name": "SkyePWA Forge",
      "count": 1,
      "items": [
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "SkyePWA Forge/SOL_SkyePWA_Forge_RateCard_31pct_Uplift.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "SkyePWA Forge"
        }
      ]
    },
    {
      "name": "SkyeSheets",
      "count": 1,
      "items": [
        {
          "urlPath": "/SkyeSheets/index.html",
          "prettyPath": "/SkyeSheets/",
          "file": "SkyeSheets/index.html",
          "title": "SkyeSheets | Data Canvas",
          "ext": ".html",
          "category": "SkyeSheets"
        }
      ]
    },
    {
      "name": "SkyeSlides",
      "count": 1,
      "items": [
        {
          "urlPath": "/SkyeSlides/index.html",
          "prettyPath": "/SkyeSlides/",
          "file": "SkyeSlides/index.html",
          "title": "SkyeSlides | Fortune 500 Storytelling",
          "ext": ".html",
          "category": "SkyeSlides"
        }
      ]
    },
    {
      "name": "sql",
      "count": 3,
      "items": [
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "sql/migrate_v1_to_v2.sql",
          "title": null,
          "ext": ".sql",
          "category": "sql"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "sql/migrate_v2_to_v5.sql",
          "title": null,
          "ext": ".sql",
          "category": "sql"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "sql/schema_v2.sql",
          "title": null,
          "ext": ".sql",
          "category": "sql"
        }
      ]
    },
    {
      "name": "status",
      "count": 1,
      "items": [
        {
          "urlPath": "/status/index.html",
          "prettyPath": "/status/",
          "file": "status/index.html",
          "title": "Status \xB7 SOLEnterprises Network",
          "ext": ".html",
          "category": "status"
        }
      ]
    },
    {
      "name": "terms",
      "count": 1,
      "items": [
        {
          "urlPath": "/terms/index.html",
          "prettyPath": "/terms/",
          "file": "terms/index.html",
          "title": "Terms \xB7 Skyes Over London LC",
          "ext": ".html",
          "category": "terms"
        }
      ]
    },
    {
      "name": "Valley Verified ",
      "count": 12,
      "items": [
        {
          "urlPath": "/Valley%20Verified%20/dakayla-clark.html",
          "prettyPath": null,
          "file": "Valley Verified /dakayla-clark.html",
          "title": "Skyes Over London \u2014 VP Profile: Dakayla Clark",
          "ext": ".html",
          "category": "Valley Verified "
        },
        {
          "urlPath": "/Valley%20Verified%20/gray-skyes.html",
          "prettyPath": null,
          "file": "Valley Verified /gray-skyes.html",
          "title": "Skyes Over London LC \u2014 Gray Skyes, Founder",
          "ext": ".html",
          "category": "Valley Verified "
        },
        {
          "urlPath": "/Valley%20Verified%20/MichoacanosTireShop.html",
          "prettyPath": null,
          "file": "Valley Verified /MichoacanosTireShop.html",
          "title": "Michoacanos Tire's Shop \u2014 Wheels, Tires, Fitment \u2022 Glendale, AZ",
          "ext": ".html",
          "category": "Valley Verified "
        },
        {
          "urlPath": "/Valley%20Verified%20/MoralesTire-Auto.html",
          "prettyPath": null,
          "file": "Valley Verified /MoralesTire-Auto.html",
          "title": "Morales Tire & Auto Care \u2014 Valley Verified | 3D Sponsor Spectacle",
          "ext": ".html",
          "category": "Valley Verified "
        },
        {
          "urlPath": "/Valley%20Verified%20/NorthStar.html",
          "prettyPath": null,
          "file": "Valley Verified /NorthStar.html",
          "title": "NorthStar Office & Accounting LLC \u2014 Back Office Command (3D Spectacle)",
          "ext": ".html",
          "category": "Valley Verified "
        },
        {
          "urlPath": "/Valley%20Verified%20/NorthStar2.html",
          "prettyPath": null,
          "file": "Valley Verified /NorthStar2.html",
          "title": "NorthStar Office & Accounting LLC \u2014 Full Site Mirror Ad (3D Spectacle)",
          "ext": ".html",
          "category": "Valley Verified "
        },
        {
          "urlPath": "/Valley%20Verified%20/NorthStarOfficial.html",
          "prettyPath": null,
          "file": "Valley Verified /NorthStarOfficial.html",
          "title": "NorthStar Office & Accounting LLC | Neon-Blue Ops + Gold-Standard Clarity",
          "ext": ".html",
          "category": "Valley Verified "
        },
        {
          "urlPath": "/Valley%20Verified%20/SentinelWebAuthority-Verified.html",
          "prettyPath": null,
          "file": "Valley Verified /SentinelWebAuthority-Verified.html",
          "title": "Sentinel Web Authority\u2122 \u2014 A SOLEnterprises Network Property",
          "ext": ".html",
          "category": "Valley Verified "
        },
        {
          "urlPath": "/Valley%20Verified%20/SentinelWebAuthority.html",
          "prettyPath": null,
          "file": "Valley Verified /SentinelWebAuthority.html",
          "title": "Sentinel Web Authority\u2122 \u2014 Distributed SEO. Real Authority. Sustainable Growth.",
          "ext": ".html",
          "category": "Valley Verified "
        },
        {
          "urlPath": "/Valley%20Verified%20/SkyeLetix.html",
          "prettyPath": null,
          "file": "Valley Verified /SkyeLetix.html",
          "title": `SkyeLetiX \u2014 The Spectacle | Premium Under-6'0" League`,
          "ext": ".html",
          "category": "Valley Verified "
        },
        {
          "urlPath": "/Valley%20Verified%20/SoleDrop-Verified.html",
          "prettyPath": null,
          "file": "Valley Verified /SoleDrop-Verified.html",
          "title": "SOLE Drop \u2014 Systems That Hold (3D Spectacle)",
          "ext": ".html",
          "category": "Valley Verified "
        },
        {
          "urlPath": "/Valley%20Verified%20/ValleyVerified.html",
          "prettyPath": null,
          "file": "Valley Verified /ValleyVerified.html",
          "title": null,
          "ext": ".html",
          "category": "Valley Verified "
        }
      ]
    },
    {
      "name": "Valuationx",
      "count": 16,
      "items": [
        {
          "urlPath": "/Valuationx/Build-Valuation1.html",
          "prettyPath": null,
          "file": "Valuationx/Build-Valuation1.html",
          "title": "SkyeSol \u2022 Proof-Asset Valuation Report (2026) \u2014 Editable Web",
          "ext": ".html",
          "category": "Valuationx"
        },
        {
          "urlPath": "/Valuationx/Build-Valuation2.html",
          "prettyPath": null,
          "file": "Valuationx/Build-Valuation2.html",
          "title": null,
          "ext": ".html",
          "category": "Valuationx"
        },
        {
          "urlPath": "/Valuationx/template.html",
          "prettyPath": null,
          "file": "Valuationx/template.html",
          "title": "SOLEnterprises.org \u2022 Proof-Asset Valuation Report (2026) \u2014 Editable Web",
          "ext": ".html",
          "category": "Valuationx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Valuationx/Deep Scan Analysis",
          "title": null,
          "ext": "",
          "category": "Valuationx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Valuationx/northstar_deep_scan_valuation (1).pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Valuationx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Valuationx/skyeletix_deep_scan_valuation.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Valuationx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Valuationx/skyesol_deep_scan_valuation.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Valuationx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Valuationx/SOLE_Nexus_Deep_Scan_Valuation_2026-02-25.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Valuationx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Valuationx/soledrop_deep_scan_valuation_2026-02-25.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Valuationx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Valuationx/SOLEnterprises_org_Proof-Asset-Valuation_2026_STYLE-1_1.png",
          "title": null,
          "ext": ".png",
          "category": "Valuationx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Valuationx/SOLEnterprises_org_Proof-Asset-Valuation_2026_STYLE-2_1.png",
          "title": null,
          "ext": ".png",
          "category": "Valuationx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Valuationx/SOLEnterprises_org_Proof-Asset-Valuation_2026_STYLE-2_2.png",
          "title": null,
          "ext": ".png",
          "category": "Valuationx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Valuationx/SOLEnterprises_org_Proof-Asset-Valuation_2026_STYLE-3_1.png",
          "title": null,
          "ext": ".png",
          "category": "Valuationx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Valuationx/SOLEnterprises_org_Proof-Asset-Valuation_2026_STYLE-4_1.png",
          "title": null,
          "ext": ".png",
          "category": "Valuationx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Valuationx/SOLEnterprises_org_Proof-Asset-Valuation_2026_STYLE.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Valuationx"
        },
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "Valuationx/solenterprisesnexusconnect_deep_scan_valuation.pdf",
          "title": null,
          "ext": ".pdf",
          "category": "Valuationx"
        }
      ]
    },
    {
      "name": "vault",
      "count": 1,
      "items": [
        {
          "urlPath": "/vault/index.html",
          "prettyPath": "/vault/",
          "file": "vault/index.html",
          "title": "Client Vault \xB7 Skyes Over London LC",
          "ext": ".html",
          "category": "vault"
        }
      ]
    },
    {
      "name": "xxDEVONLY",
      "count": 1,
      "items": [
        {
          "urlPath": null,
          "prettyPath": null,
          "file": "xxDEVONLY/Prime",
          "title": null,
          "ext": "",
          "category": "xxDEVONLY"
        }
      ]
    }
  ]
};

// netlify/functions/admin-site-menu.mjs
function safeEqual(a, b) {
  const aa = Buffer.from(String(a ?? ""));
  const bb = Buffer.from(String(b ?? ""));
  if (aa.length !== bb.length) return false;
  return import_node_crypto.default.timingSafeEqual(aa, bb);
}
async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store"
      },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }
  const expected = process.env.DEMONKEY || process.env.Demonkey;
  if (!expected) {
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store"
      },
      body: JSON.stringify({ error: "Server misconfigured: DEMONKEY not set" })
    };
  }
  let provided = "";
  try {
    const parsed = JSON.parse(event.body || "{}");
    provided = parsed?.demonkey ?? parsed?.key ?? "";
  } catch {
    provided = "";
  }
  if (!safeEqual(provided, expected)) {
    return {
      statusCode: 401,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store"
      },
      body: JSON.stringify({ error: "Unauthorized" })
    };
  }
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    },
    body: JSON.stringify(SITE_MENU)
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
