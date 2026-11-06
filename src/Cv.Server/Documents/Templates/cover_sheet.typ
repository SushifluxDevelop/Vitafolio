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
  title: t("Deckblatt", "Cover Sheet"),
  author: data.at("firstName", default: "") + " " + data.at("lastName", default: "")
)

#set page(
  paper: "a4",
  margin: (top: 0cm, bottom: 2.5cm, left: 0cm, right: 0cm),
  header: none,
  footer: none
)

#set text(
  font: (font-name, "Liberation Sans", "DejaVu Sans", "Arial"),
  size: 10pt,
  fill: rgb("#1e293b"),
  lang: lang
)

// Accent top header bar
#block(
  width: 100%,
  height: 22mm,
  fill: accent,
  outset: 0pt
)[]

#pad(x: 30mm, top: 15mm)[
  // Title & Target Position
  #text(size: 13pt, weight: "bold", tracking: 3pt, fill: rgb("#64748b"))[
    #upper(t("Bewerbung", "Application Dossier"))
  ]
  #v(3mm)

  #let target-job = data.at("targetJob", default: data.at("professionalTitle", default: ""))
  #if target-job != "" [
    #text(size: 24pt, weight: "bold", fill: accent)[#target-job]
    #v(2mm)
  ]

  #let target-company = data.at("targetCompany", default: "")
  #if target-company != "" [
    #text(size: 13pt, weight: "medium", fill: rgb("#475569"))[
      #t("bei", "at") #target-company
    ]
    #v(4mm)
  ]

  #v(8mm)
  #line(length: 100%, stroke: 1.5pt + rgb("#e2e8f0"))
  #v(10mm)

  // Photo & Candidate Info
  #grid(
    columns: if photo-file != "" and show-photo { (auto, 1fr) } else { (1fr) },
    gutter: 25mm,
    align: (horizon + center, horizon + left),
    if photo-file != "" and show-photo [
      #let radius = if photo-shape == "circle" { 50% } else if photo-shape == "rounded" { 16pt } else { 0pt }
      #box(
        width: 140pt,
        height: 180pt,
        radius: radius,
        clip: true,
        stroke: 2pt + rgb("#ffffff")
      )[
        #image(photo-file, width: 100%, height: 100%, fit: "cover")
      ]
    ],
    [
      #let academic = data.at("academicTitle", default: none)
      #let full-name = (
        if academic != none and academic != "" { academic + " " } else { "" }
        + data.at("firstName", default: "")
        + " "
        + data.at("lastName", default: "")
      )
      #text(size: 20pt, weight: "bold", fill: rgb("#0f172a"))[#full-name]

      #let prof = data.at("professionalTitle", default: "")
      #if prof != "" [
        #v(1mm)
        #text(size: 11pt, weight: "medium", fill: rgb("#64748b"))[#prof]
      ]

      #v(6mm)
      #block(
        fill: rgb("#f8fafc"),
        inset: 12pt,
        radius: 8pt,
        stroke: 1pt + rgb("#e2e8f0"),
        width: 100%
      )[
        #set text(size: 9.5pt, fill: rgb("#334155"))
        #grid(
          columns: (auto, 1fr),
          column-gutter: 10pt,
          row-gutter: 5pt,
          [#text(weight: "bold", fill: accent)[#t("Adresse:", "Address:")]],
          [
            #let street = data.at("street", default: "")
            #let postal = data.at("postalCode", default: "")
            #let city = data.at("city", default: "")
            #if street != "" [ #street \ ]
            #if postal != "" or city != "" [ #(postal + " " + city) ]
          ],
          [#text(weight: "bold", fill: accent)[E-Mail:]],
          [#data.at("email", default: "-")],
          [#text(weight: "bold", fill: accent)[#t("Telefon:", "Phone:")]],
          [#data.at("phone", default: "-")],
          if data.at("website", default: "") != "" [
            #text(weight: "bold", fill: accent)[Web:]
          ],
          if data.at("website", default: "") != "" [
            #data.at("website", default: "")
          ]
        )
      ]
    ]
  )

  #v(15mm)

  // Contents table / Anlagenverzeichnis
  #let contents-list = data.at("contents", default: (
    t("Anschreiben", "Cover Letter"),
    t("Tabellarischer Lebenslauf", "Curriculum Vitae"),
    t("Arbeits- und Praktikumszeugnisse", "Letters of Recommendation & Certificates"),
    t("Ausbildungs- und Studienabschlüsse", "Academic & Training Diplomas")
  ))

  #block(width: 100%)[
    #text(size: 11pt, weight: "bold", fill: accent)[
      #upper(t("Inhalt der Bewerbungsunterlagen", "Application Contents"))
    ]
    #v(3mm)
    #line(length: 100%, stroke: 1pt + accent)
    #v(4mm)

    #for (idx, item) in contents-list.enumerate() [
      #grid(
        columns: (25pt, 1fr),
        gutter: 8pt,
        align: (left + horizon, left + horizon),
        [
          #box(
            fill: accent,
            radius: 4pt,
            inset: (x: 5pt, y: 3pt),
            [#text(size: 8.5pt, weight: "bold", fill: rgb("#ffffff"))[#(idx + 1)]]
          )
        ],
        [
          #text(size: 10.5pt, weight: "medium", fill: rgb("#1e293b"))[#item]
        ]
      )
      #v(2.5mm)
    ]
  ]
]

