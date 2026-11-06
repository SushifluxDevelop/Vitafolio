#let raw-data = sys.inputs.at("data", default: "{}")
#let raw-options = sys.inputs.at("options", default: "{}")
#let photo-file = sys.inputs.at("photo", default: "")

#let data = json(bytes(raw-data))
#let options = json(bytes(raw-options))

#let lang = options.at("language", default: "de")
#let accent-hex = options.at("accentColor", default: "#14213D")
#let accent = rgb(accent-hex)
#let font-name = options.at("font", default: "Liberation Sans")
#let show-photo = options.at("showPhoto", default: true)
#let photo-shape = options.at("photoShape", default: "rounded")

#let is-en = lang == "en"

#let t(de, en) = if is-en { en } else { de }

#set document(
  title: t("Lebenslauf", "Curriculum Vitae"),
  author: data.at("firstName", default: "") + " " + data.at("lastName", default: "")
)

#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2cm, left: 2.2cm, right: 2.2cm),
  numbering: "1 / 1"
)

#set text(
  font: (font-name, "Liberation Sans", "DejaVu Sans", "Arial"),
  size: 9.5pt,
  fill: rgb("#1e293b"),
  lang: lang
)

#let section-heading(title) = {
  v(12pt, weak: true)
  block(width: 100%)[
    #text(size: 11.5pt, weight: "bold", fill: accent)[#upper(title)]
    #v(3pt)
    #line(length: 100%, stroke: 1pt + accent)
  ]
  v(6pt, weak: true)
}

// Header
#grid(
  columns: if photo-file != "" and show-photo { (1fr, auto) } else { (1fr) },
  gutter: 20pt,
  align: (left + horizon, right + horizon),
  [
    #let academic = data.at("academicTitle", default: none)
    #let full-name = (
      if academic != none and academic != "" { academic + " " } else { "" }
      + data.at("firstName", default: "")
      + " "
      + data.at("lastName", default: "")
    )
    #text(size: 20pt, weight: "bold", fill: accent)[#full-name]

    #let prof-title = data.at("professionalTitle", default: none)
    #if prof-title != none and prof-title != "" [
      #v(3pt)
      #text(size: 12pt, weight: "medium", fill: rgb("#475569"))[#prof-title]
    ]

    #v(6pt)
    #grid(
      columns: (auto, auto),
      column-gutter: 14pt,
      row-gutter: 3pt,
      [#text(size: 8.5pt, fill: rgb("#64748b"))[
        #let email = data.at("email", default: none)
        #let phone = data.at("phone", default: none)
        #if email != none and email != "" [ #text(weight: "medium")[E-Mail:] #email \ ]
        #if phone != none and phone != "" [ #text(weight: "medium")[#t("Tel:", "Phone:")] #phone \ ]
        #let street = data.at("street", default: none)
        #let postal = data.at("postalCode", default: none)
        #let city = data.at("city", default: none)
        #let country = data.at("country", default: none)
        #let addr = ()
        #if street != none and street != "" { addr.push(street) }
        #let pc = ()
        #if postal != none and postal != "" { pc.push(postal) }
        #if city != none and city != "" { pc.push(city) }
        #if pc.len() > 0 { addr.push(pc.join(" ")) }
        #if country != none and country != "" { addr.push(country) }
        #if addr.len() > 0 [ #text(weight: "medium")[#t("Adresse:", "Address:")] #addr.join(", ") ]
      ]],
      [#text(size: 8.5pt, fill: rgb("#64748b"))[
        #let web = data.at("website", default: none)
        #let linkedin = data.at("linkedIn", default: none)
        #let github = data.at("gitHub", default: none)
        #let xing = data.at("xing", default: none)
        #if web != none and web != "" [ #text(weight: "medium")[Web:] #web \ ]
        #if linkedin != none and linkedin != "" [ #text(weight: "medium")[LinkedIn:] #linkedin \ ]
        #if github != none and github != "" [ #text(weight: "medium")[GitHub:] #github \ ]
        #if xing != none and xing != "" [ #text(weight: "medium")[Xing:] #xing \ ]
      ]]
    )
  ],
  if photo-file != "" and show-photo [
    #let radius = if photo-shape == "round" { 50% } else if photo-shape == "rect" { 0pt } else { 8pt }
    #box(
      width: 80pt,
      height: 96pt,
      radius: radius,
      clip: true,
      stroke: 1.5pt + rgb("#cbd5e1")
    )[
      #image(photo-file, width: 100%, height: 100%, fit: "cover")
    ]
  ]
)

// Personal details row (Geburtsdatum, Staatsangehörigkeit, etc.)
#let dob = data.at("dateOfBirth", default: none)
#let pob = data.at("placeOfBirth", default: none)
#let nat = data.at("nationality", default: none)
#let ms = data.at("maritalStatus", default: none)
#let details = ()
#if dob != none and dob != "" {
  let b = t("Geboren am ", "Born on ") + dob
  if pob != none and pob != "" { b += " in " + pob }
  details.push(b)
}
#if nat != none and nat != "" { details.push(t("Staatsangehörigkeit: ", "Nationality: ") + nat) }
#if ms != none and ms != "" { details.push(t("Familienstand: ", "Marital status: ") + ms) }

#if details.len() > 0 [
  #v(4pt)
  #text(size: 8.5pt, fill: rgb("#64748b"))[#details.join("  |  ")]
]

// Kurzprofil / Bio
#let bio = data.at("bio", default: none)
#if bio != none and bio != "" [
  #section-heading(t("Kurzprofil", "About Me"))
  #text(size: 9.5pt, style: "italic")[#bio]
]

// Berufserfahrung
#let exps = data.at("experiences", default: ())
#if exps.len() > 0 [
  #section-heading(t("Berufserfahrung", "Work Experience"))
  #for exp in exps [
    #let start = exp.at("startDate", default: "")
    #let end = if exp.at("isCurrent", default: false) { t("heute", "Present") } else { exp.at("endDate", default: "") }
    #let date-str = if end != "" { start + " – " + end } else { start }

    #grid(
      columns: (110pt, 1fr),
      column-gutter: 14pt,
      row-gutter: 3pt,
      [
        #text(size: 9pt, weight: "medium", fill: rgb("#475569"))[#date-str]
      ],
      [
        #text(size: 10pt, weight: "bold", fill: rgb("#0f172a"))[#exp.at("jobTitle", default: "")]
        \
        #let emp-line = exp.at("employer", default: "")
        #let city = exp.at("city", default: "")
        #if city != "" { emp-line += ", " + city }
        #let type = exp.at("employmentType", default: "")
        #if type != "" { emp-line += " (" + type + ")" }
        #text(size: 9pt, fill: rgb("#334155"))[#emp-line]

        #let desc = exp.at("description", default: "")
        #if desc != "" [
          #v(2pt)
          #text(size: 9pt, fill: rgb("#475569"))[#desc]
        ]
        #v(6pt)
      ]
    )
  ]
]

// Ausbildung
#let edus = data.at("educations", default: ())
#if edus.len() > 0 [
  #section-heading(t("Ausbildung", "Education"))
  #for edu in edus [
    #let start = edu.at("startDate", default: "")
    #let end = if edu.at("isCurrent", default: false) { t("heute", "Present") } else { edu.at("endDate", default: "") }
    #let date-str = if end != "" { start + " – " + end } else { start }

    #grid(
      columns: (110pt, 1fr),
      column-gutter: 14pt,
      row-gutter: 3pt,
      [
        #text(size: 9pt, weight: "medium", fill: rgb("#475569"))[#date-str]
      ],
      [
        #let deg-str = edu.at("degree", default: "")
        #let field = edu.at("fieldOfStudy", default: "")
        #if field != "" { deg-str += " – " + field }
        #text(size: 10pt, weight: "bold", fill: rgb("#0f172a"))[#deg-str]
        \
        #let inst-line = edu.at("institution", default: "")
        #let city = edu.at("city", default: "")
        #if city != "" { inst-line += ", " + city }
        #let grade = edu.at("grade", default: "")
        #if grade != "" { inst-line += " (" + t("Note: ", "Grade: ") + grade + ")" }
        #text(size: 9pt, fill: rgb("#334155"))[#inst-line]

        #let desc = edu.at("description", default: "")
        #if desc != "" [
          #v(2pt)
          #text(size: 9pt, fill: rgb("#475569"))[#desc]
        ]
        #v(6pt)
      ]
    )
  ]
]

// Kenntnisse
#let skills = data.at("skills", default: ())
#if skills.len() > 0 [
  #section-heading(t("Kenntnisse", "Skills"))
  #let cat-map = (:)
  #for s in skills {
    let cat = s.at("category", default: "")
    if cat == "" { cat = t("Allgemein", "General") }
    if cat not in cat-map {
      cat-map.insert(cat, ())
    }
    cat-map.at(cat).push(s)
  }

  #for (cat, items) in cat-map [
    #grid(
      columns: (110pt, 1fr),
      column-gutter: 14pt,
      [
        #text(size: 9pt, weight: "bold", fill: rgb("#475569"))[#cat]
      ],
      [
        #let item-strings = ()
        #for it in items {
          let lvl = it.at("level", default: 0)
          let lvl-str = if lvl > 0 { " (" + str(lvl) + "/5)" } else { "" }
          item-strings.push(it.at("name", default: "") + lvl-str)
        }
        #text(size: 9pt)[#item-strings.join("  •  ")]
        #v(4pt)
      ]
    )
  ]
]

// Sprachen
#let langs = data.at("languages", default: ())
#if langs.len() > 0 [
  #section-heading(t("Sprachen", "Languages"))
  #grid(
    columns: (110pt, 1fr),
    column-gutter: 14pt,
    [
      #text(size: 9pt, weight: "bold", fill: rgb("#475569"))[#t("Sprachkenntnisse", "Language Skills")]
    ],
    [
      #let lang-strings = ()
      #for l in langs {
        lang-strings.push(l.at("language", default: "") + " (" + l.at("level", default: "") + ")")
      }
      #text(size: 9pt)[#lang-strings.join("  •  ")]
      #v(4pt)
    ]
  )
]

// Zertifikate
#let certs = data.at("certificates", default: ())
#if certs.len() > 0 [
  #section-heading(t("Zertifikate & Weiterbildung", "Certificates & Training"))
  #for c in certs [
    #grid(
      columns: (110pt, 1fr),
      column-gutter: 14pt,
      [
        #text(size: 9pt, weight: "medium", fill: rgb("#475569"))[#c.at("issueDate", default: "")]
      ],
      [
        #text(size: 9.5pt, weight: "bold", fill: rgb("#0f172a"))[#c.at("title", default: "")]
        #let issuer = c.at("issuer", default: "")
        #if issuer != "" [ — #text(size: 9pt, fill: rgb("#475569"))[#issuer] ]
        #let cid = c.at("credentialId", default: "")
        #if cid != "" [ #text(size: 8pt, fill: rgb("#64748b"))[(ID: #cid)] ]
        #v(4pt)
      ]
    )
  ]
]

// Interessen
#let interests = data.at("interests", default: ())
#if interests.len() > 0 [
  #section-heading(t("Interessen & Aktivitäten", "Interests & Activities"))
  #let int-names = ()
  #for i in interests {
    let name = i.at("name", default: "")
    let cat = i.at("category", default: "")
    if cat != "" { name += " (" + cat + ")" }
    int-names.push(name)
  }
  #text(size: 9pt)[#int-names.join("  •  ")]
  #v(4pt)
]

// Eigene Abschnitte
#let custom-sections = data.at("customSections", default: ())
#for sec in custom-sections [
  #section-heading(sec.at("title", default: t("Zusatzabschnitt", "Custom Section")))
  #let items = sec.at("items", default: ())
  #for it in items [
    #grid(
      columns: (110pt, 1fr),
      column-gutter: 14pt,
      [
        #text(size: 9pt, weight: "medium", fill: rgb("#475569"))[#it.at("dateRange", default: "")]
      ],
      [
        #text(size: 9.5pt, weight: "bold", fill: rgb("#0f172a"))[#it.at("title", default: "")]
        #let sub = it.at("subtitle", default: "")
        #if sub != "" [ — #text(size: 9pt, fill: rgb("#475569"))[#sub] ]
        #let desc = it.at("description", default: "")
        #if desc != "" [
          #v(2pt)
          #text(size: 9pt, fill: rgb("#475569"))[#desc]
        ]
        #v(4pt)
      ]
    )
  ]
]

