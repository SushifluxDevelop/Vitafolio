#let raw-data = sys.inputs.at("data", default: "{}")
#let raw-options = sys.inputs.at("options", default: "{}")
#let photo-file = sys.inputs.at("photo", default: "")

#let data = json(bytes(raw-data))
#let options = json(bytes(raw-options))

#let lang = options.at("language", default: "de")
#let accent-hex = options.at("accentColor", default: "#0284c7")
#let accent = rgb(accent-hex)
#let font-name = options.at("font", default: "Liberation Sans")
#let show-photo = options.at("showPhoto", default: true)
#let photo-shape = options.at("photoShape", default: "round")

#let is-en = lang == "en"
#let t(de, en) = if is-en { en } else { de }

#set document(
  title: t("Lebenslauf", "Curriculum Vitae"),
  author: data.at("firstName", default: "") + " " + data.at("lastName", default: "")
)

#set page(
  paper: "a4",
  margin: (top: 1.4cm, bottom: 1.4cm, left: 1.4cm, right: 1.4cm),
  numbering: "1 / 1"
)

#set text(
  font: (font-name, "Liberation Sans", "DejaVu Sans", "Arial"),
  size: 9pt,
  fill: rgb("#1e293b"),
  lang: lang
)

#let main-heading(title) = {
  v(10pt, weak: true)
  block(width: 100%)[
    #text(size: 11pt, weight: "bold", fill: accent)[#upper(title)]
    #v(2pt)
    #line(length: 100%, stroke: 1.5pt + accent)
  ]
  v(5pt, weak: true)
}

#let side-heading(title) = {
  v(8pt, weak: true)
  block(width: 100%)[
    #text(size: 9.5pt, weight: "bold", fill: accent)[#upper(title)]
    #v(2pt)
    #line(length: 100%, stroke: 0.75pt + rgb("#cbd5e1"))
  ]
  v(4pt, weak: true)
}

#let skill-dots(level, color) = {
  box(baseline: -1pt)[
    #for i in range(1, 6) {
      box(
        width: 5.5pt,
        height: 5.5pt,
        radius: 2.75pt,
        fill: if i <= level { color } else { rgb("#e2e8f0") }
      )
      h(2pt)
    }
  ]
}

// 2-Column Layout Grid
#grid(
  columns: (165pt, 1fr),
  column-gutter: 20pt,
  // === SIDEBAR (LEFT) ===
  [
    #block(
      fill: rgb("#f8fafc"),
      inset: (x: 10pt, y: 12pt),
      radius: 6pt,
      stroke: 0.5pt + rgb("#e2e8f0"),
      width: 100%
    )[
      // Photo
      #if photo-file != "" and show-photo [
        #align(center)[
          #let radius = if photo-shape == "round" { 50% } else if photo-shape == "rect" { 0pt } else { 8pt }
          #box(
            width: 85pt,
            height: 85pt,
            radius: radius,
            clip: true,
            stroke: 2pt + accent
          )[
            #image(photo-file, width: 100%, height: 100%, fit: "cover")
          ]
        ]
        #v(8pt)
      ]

      // Contact info
      #side-heading(t("Kontakt", "Contact"))
      #let email = data.at("email", default: none)
      #let phone = data.at("phone", default: none)
      #let street = data.at("street", default: none)
      #let postal = data.at("postalCode", default: none)
      #let city = data.at("city", default: none)
      #let country = data.at("country", default: none)

      #if email != none and email != "" [
        #text(size: 8pt, weight: "bold", fill: rgb("#64748b"))[E-Mail] \
        #text(size: 8.5pt)[#email] \
        #v(3pt)
      ]
      #if phone != none and phone != "" [
        #text(size: 8pt, weight: "bold", fill: rgb("#64748b"))[#t("Telefon", "Phone")] \
        #text(size: 8.5pt)[#phone] \
        #v(3pt)
      ]
      #let addr-parts = ()
      #if street != none and street != "" { addr-parts.push(street) }
      #let pc = ()
      #if postal != none and postal != "" { pc.push(postal) }
      #if city != none and city != "" { pc.push(city) }
      #if pc.len() > 0 { addr-parts.push(pc.join(" ")) }
      #if country != none and country != "" { addr-parts.push(country) }
      #if addr-parts.len() > 0 [
        #text(size: 8pt, weight: "bold", fill: rgb("#64748b"))[#t("Adresse", "Address")] \
        #text(size: 8.5pt)[#addr-parts.join("\n")] \
        #v(3pt)
      ]

      // Links
      #let web = data.at("website", default: none)
      #let linkedin = data.at("linkedIn", default: none)
      #let github = data.at("gitHub", default: none)
      #let xing = data.at("xing", default: none)
      #if (web != none and web != "") or (linkedin != none and linkedin != "") or (github != none and github != "") or (xing != none and xing != "") [
        #side-heading(t("Links & Profile", "Links & Profiles"))
        #if web != none and web != "" [ #text(size: 8pt, weight: "bold", fill: rgb("#64748b"))[Web] \ #text(size: 8.5pt)[#web] \ #v(2pt) ]
        #if linkedin != none and linkedin != "" [ #text(size: 8pt, weight: "bold", fill: rgb("#64748b"))[LinkedIn] \ #text(size: 8.5pt)[#linkedin] \ #v(2pt) ]
        #if github != none and github != "" [ #text(size: 8pt, weight: "bold", fill: rgb("#64748b"))[GitHub] \ #text(size: 8.5pt)[#github] \ #v(2pt) ]
        #if xing != none and xing != "" [ #text(size: 8pt, weight: "bold", fill: rgb("#64748b"))[Xing] \ #text(size: 8.5pt)[#xing] \ #v(2pt) ]
      ]

      // Personal Details
      #let dob = data.at("dateOfBirth", default: none)
      #let pob = data.at("placeOfBirth", default: none)
      #let nat = data.at("nationality", default: none)
      #let ms = data.at("maritalStatus", default: none)
      #if (dob != none and dob != "") or (nat != none and nat != "") or (ms != none and ms != "") [
        #side-heading(t("Persönliches", "Personal"))
        #if dob != none and dob != "" [
          #text(size: 8pt, weight: "bold", fill: rgb("#64748b"))[#t("Geburtsdatum", "Date of Birth")] \
          #text(size: 8.5pt)[#dob #if pob != none and pob != "" [(#pob)]] \
          #v(2pt)
        ]
        #if nat != none and nat != "" [
          #text(size: 8pt, weight: "bold", fill: rgb("#64748b"))[#t("Nationalität", "Nationality")] \
          #text(size: 8.5pt)[#nat] \
          #v(2pt)
        ]
        #if ms != none and ms != "" [
          #text(size: 8pt, weight: "bold", fill: rgb("#64748b"))[#t("Familienstand", "Marital Status")] \
          #text(size: 8.5pt)[#ms] \
          #v(2pt)
        ]
      ]

      // Skills in Sidebar
      #let skills = data.at("skills", default: ())
      #if skills.len() > 0 [
        #side-heading(t("Kenntnisse", "Skills"))
        #for s in skills [
          #let lvl = s.at("level", default: 0)
          #grid(
            columns: (1fr, auto),
            gutter: 4pt,
            [#text(size: 8.5pt, weight: "medium")[#s.at("name", default: "")]],
            [#if lvl > 0 { skill-dots(lvl, accent) }]
          )
          #v(2pt)
        ]
      ]

      // Languages in Sidebar
      #let langs = data.at("languages", default: ())
      #if langs.len() > 0 [
        #side-heading(t("Sprachen", "Languages"))
        #for l in langs [
          #grid(
            columns: (1fr, auto),
            gutter: 4pt,
            [#text(size: 8.5pt, weight: "medium")[#l.at("language", default: "")]],
            [
              #box(
                fill: accent.lighten(85%),
                inset: (x: 4pt, y: 1.5pt),
                radius: 3pt
              )[
                #text(size: 7.5pt, weight: "bold", fill: accent)[#l.at("level", default: "")]
              ]
            ]
          )
          #v(2.5pt)
        ]
      ]

      // Interests in Sidebar
      #let interests = data.at("interests", default: ())
      #if interests.len() > 0 [
        #side-heading(t("Interessen", "Interests"))
        #for i in interests [
          #let name = i.at("name", default: "")
          #let cat = i.at("category", default: "")
          #text(size: 8.5pt)[• #name #if cat != "" [ (#cat)]] \
          #v(1.5pt)
        ]
      ]
    ]
  ],

  // === MAIN COLUMN (RIGHT) ===
  [
    // Main Header (Name & Title)
    #let academic = data.at("academicTitle", default: none)
    #let full-name = (
      if academic != none and academic != "" { academic + " " } else { "" }
      + data.at("firstName", default: "")
      + " "
      + data.at("lastName", default: "")
    )
    #text(size: 22pt, weight: "bold", fill: accent)[#full-name]

    #let prof-title = data.at("professionalTitle", default: none)
    #if prof-title != none and prof-title != "" [
      #v(2pt)
      #text(size: 13pt, weight: "medium", fill: rgb("#475569"))[#prof-title]
    ]

    #v(4pt)
    #line(length: 100%, stroke: 2pt + accent)

    // Kurzprofil
    #let bio = data.at("bio", default: none)
    #if bio != none and bio != "" [
      #main-heading(t("Profil", "Profile"))
      #text(size: 9.5pt, style: "italic", fill: rgb("#334155"))[#bio]
      #v(6pt)
    ]

    // Berufserfahrung
    #let exps = data.at("experiences", default: ())
    #if exps.len() > 0 [
      #main-heading(t("Berufserfahrung", "Work Experience"))
      #for exp in exps [
        #let start = exp.at("startDate", default: "")
        #let end = if exp.at("isCurrent", default: false) { t("heute", "Present") } else { exp.at("endDate", default: "") }
        #let date-str = if end != "" { start + " – " + end } else { start }

        #grid(
          columns: (1fr, auto),
          gutter: 4pt,
          [#text(size: 10pt, weight: "bold", fill: rgb("#0f172a"))[#exp.at("jobTitle", default: "")]],
          [#text(size: 8.5pt, weight: "medium", fill: accent)[#date-str]]
        )

        #let emp-line = exp.at("employer", default: "")
        #let city = exp.at("city", default: "")
        #if city != "" { emp-line += " | " + city }
        #let type = exp.at("employmentType", default: "")
        #if type != "" { emp-line += " (" + type + ")" }
        #text(size: 9pt, weight: "medium", fill: rgb("#475569"))[#emp-line]

        #let desc = exp.at("description", default: "")
        #if desc != "" [
          #v(2pt)
          #text(size: 8.5pt, fill: rgb("#334155"))[#desc]
        ]
        #v(8pt)
      ]
    ]

    // Ausbildung
    #let edus = data.at("educations", default: ())
    #if edus.len() > 0 [
      #main-heading(t("Ausbildung", "Education"))
      #for edu in edus [
        #let start = edu.at("startDate", default: "")
        #let end = if edu.at("isCurrent", default: false) { t("heute", "Present") } else { edu.at("endDate", default: "") }
        #let date-str = if end != "" { start + " – " + end } else { start }

        #let deg-str = edu.at("degree", default: "")
        #let field = edu.at("fieldOfStudy", default: "")
        #if field != "" { deg-str += " – " + field }

        #grid(
          columns: (1fr, auto),
          gutter: 4pt,
          [#text(size: 10pt, weight: "bold", fill: rgb("#0f172a"))[#deg-str]],
          [#text(size: 8.5pt, weight: "medium", fill: accent)[#date-str]]
        )

        #let inst-line = edu.at("institution", default: "")
        #let city = edu.at("city", default: "")
        #if city != "" { inst-line += " | " + city }
        #let grade = edu.at("grade", default: "")
        #if grade != "" { inst-line += " (" + t("Note: ", "Grade: ") + grade + ")" }
        #text(size: 9pt, weight: "medium", fill: rgb("#475569"))[#inst-line]

        #let desc = edu.at("description", default: "")
        #if desc != "" [
          #v(2pt)
          #text(size: 8.5pt, fill: rgb("#334155"))[#desc]
        ]
        #v(8pt)
      ]
    ]

    // Zertifikate
    #let certs = data.at("certificates", default: ())
    #if certs.len() > 0 [
      #main-heading(t("Zertifikate & Weiterbildung", "Certificates & Training"))
      #for c in certs [
        #grid(
          columns: (1fr, auto),
          gutter: 4pt,
          [
            #text(size: 9.5pt, weight: "bold", fill: rgb("#0f172a"))[#c.at("title", default: "")]
            #let issuer = c.at("issuer", default: "")
            #if issuer != "" [ — #text(size: 9pt, fill: rgb("#475569"))[#issuer] ]
          ],
          [#text(size: 8.5pt, weight: "medium", fill: accent)[#c.at("issueDate", default: "")]]
        )
        #let cid = c.at("credentialId", default: "")
        #if cid != "" [ #text(size: 8pt, fill: rgb("#64748b"))[(ID: #cid)] ]
        #v(4pt)
      ]
    ]

    // Eigene Abschnitte
    #let custom-sections = data.at("customSections", default: ())
    #for sec in custom-sections [
      #main-heading(sec.at("title", default: t("Zusatzabschnitt", "Custom Section")))
      #let items = sec.at("items", default: ())
      #for it in items [
        #grid(
          columns: (1fr, auto),
          gutter: 4pt,
          [
            #text(size: 9.5pt, weight: "bold", fill: rgb("#0f172a"))[#it.at("title", default: "")]
            #let sub = it.at("subtitle", default: "")
            #if sub != "" [ — #text(size: 9pt, fill: rgb("#475569"))[#sub] ]
          ],
          [#text(size: 8.5pt, weight: "medium", fill: accent)[#it.at("dateRange", default: "")]]
        )
        #let desc = it.at("description", default: "")
        #if desc != "" [
          #v(2pt)
          #text(size: 8.5pt, fill: rgb("#334155"))[#desc]
        ]
        #v(6pt)
      ]
    ]
  ]
)

