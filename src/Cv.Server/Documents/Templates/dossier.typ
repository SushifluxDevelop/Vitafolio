#let raw-data = sys.inputs.at("data", default: "{}")
#let raw-options = sys.inputs.at("options", default: "{}")
#let raw-cover-letter = sys.inputs.at("coverLetter", default: "{}")
#let photo-file = sys.inputs.at("photo", default: "")
#let signature-file = sys.inputs.at("signature", default: "")

#let data = json(bytes(raw-data))
#let options = json(bytes(raw-options))
#let cover-letter = json(bytes(raw-cover-letter))

#let lang = options.at("language", default: "de")
#let accent-hex = options.at("accentColor", default: "#14213D")
#let accent = rgb(accent-hex)
#let font-name = options.at("font", default: "Liberation Sans")
#let show-photo = options.at("showPhoto", default: true)
#let photo-shape = options.at("photoShape", default: "rounded")
#let design = options.at("design", default: "classic")
#let include-cover-sheet = options.at("includeCoverSheet", default: true)
#let has-cover-letter = cover-letter.at("subject", default: "") != ""

#let is-en = lang == "en"
#let t(de, en) = if is-en { en } else { de }

#set document(
  title: t("Bewerbungsmappe", "Application Dossier"),
  author: data.at("firstName", default: "") + " " + data.at("lastName", default: "")
)

#set text(
  font: (font-name, "Liberation Sans", "DejaVu Sans", "Arial"),
  size: 10pt,
  fill: rgb("#1e293b"),
  lang: lang
)

// Helper: Section heading
#let section-heading(title) = {
  v(12pt, weak: true)
  block(width: 100%)[
    #text(size: 11.5pt, weight: "bold", fill: accent)[#upper(title)]
    #v(3pt)
    #line(length: 100%, stroke: 1pt + accent)
  ]
  v(6pt, weak: true)
}

// ==========================================
// 1. DECKBLATT (Cover Sheet)
// ==========================================
#if include-cover-sheet [
  #set page(
    paper: "a4",
    margin: (top: 0cm, bottom: 2.5cm, left: 0cm, right: 0cm),
    header: none,
    footer: none
  )

  #block(
    width: 100%,
    height: 22mm,
    fill: accent,
    outset: 0pt
  )[]

  #pad(x: 30mm, top: 15mm)[
    #text(size: 13pt, weight: "bold", tracking: 3pt, fill: rgb("#64748b"))[
      #upper(t("Bewerbung", "Application Dossier"))
    ]
    #v(3mm)

    #let target-job = options.at("targetJob", default: data.at("professionalTitle", default: ""))
    #if target-job != "" [
      #text(size: 24pt, weight: "bold", fill: accent)[#target-job]
      #v(2mm)
    ]

    #let target-company = options.at("targetCompany", default: "")
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
    #let contents-list = (
      if has-cover-letter { (t("Anschreiben", "Cover Letter"),) } else { () }
      + (t("Tabellarischer Lebenslauf", "Curriculum Vitae"),)
      + (t("Arbeits- und Praktikumszeugnisse", "Letters of Recommendation & Certificates"),)
      + (t("Ausbildungs- und Studienabschlüsse", "Academic & Training Diplomas"),)
    )

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

  pagebreak()
]

// ==========================================
// 2. DIN 5008 ANSCHREIBEN (Cover Letter)
// ==========================================
#if has-cover-letter [
  #set page(
    paper: "a4",
    margin: (top: 20mm, bottom: 20mm, left: 25mm, right: 20mm),
    header: none,
    footer: none,
    background: {
      place(top + left, dx: 5mm, dy: 105mm, line(length: 4mm, stroke: 0.35pt + rgb("#94a3b8")))
      place(top + left, dx: 5mm, dy: 148.5mm, line(length: 6mm, stroke: 0.45pt + rgb("#94a3b8")))
      place(top + left, dx: 5mm, dy: 210mm, line(length: 4mm, stroke: 0.35pt + rgb("#94a3b8")))
    }
  )

  #set par(justify: true, leading: 0.72em)

  #let sender-name = cover-letter.at("senderName", default: data.at("firstName", default: "") + " " + data.at("lastName", default: ""))
  #let sender-street = cover-letter.at("senderStreet", default: data.at("street", default: ""))
  #let sender-postal = cover-letter.at("senderPostalCode", default: data.at("postalCode", default: ""))
  #let sender-city = cover-letter.at("senderCity", default: data.at("city", default: ""))
  #let sender-phone = cover-letter.at("senderPhone", default: data.at("phone", default: ""))
  #let sender-email = cover-letter.at("senderEmail", default: data.at("email", default: ""))

  // Sender Header
  #grid(
    columns: (1fr, auto),
    align: (left + top, right + top),
    [
      #if sender-name != "" [
        #text(size: 16pt, weight: "bold", fill: accent)[#sender-name]
      ]
    ],
    [
      #set text(size: 8pt, fill: rgb("#64748b"))
      #let contact-parts = ()
      #if sender-street != "" { contact-parts.push(sender-street) }
      #if sender-postal != "" or sender-city != "" {
        contact-parts.push(sender-postal + " " + sender-city)
      }
      #if sender-phone != "" { contact-parts.push(sender-phone) }
      #if sender-email != "" { contact-parts.push(sender-email) }
      #for (idx, item) in contact-parts.enumerate() [
        #item
        #if idx < contact-parts.len() - 1 [ \ ]
      ]
    ]
  )

  #v(8mm)

  // Address zone
  #let ret-parts = ()
  #if sender-name != "" { ret-parts.push(sender-name) }
  #if sender-street != "" { ret-parts.push(sender-street) }
  #if sender-postal != "" or sender-city != "" { ret-parts.push(sender-postal + " " + sender-city) }
  #let ret-line = ret-parts.join(" · ")

  #let recipient-company = cover-letter.at("recipientCompany", default: "")
  #let recipient-dept = cover-letter.at("recipientDepartment", default: "")
  #let recipient-contact = cover-letter.at("recipientContactPerson", default: "")
  #let recipient-street = cover-letter.at("recipientStreet", default: "")
  #let recipient-postal = cover-letter.at("recipientPostalCode", default: "")
  #let recipient-city = cover-letter.at("recipientCity", default: "")
  #let recipient-country = cover-letter.at("recipientCountry", default: "")
  #let letter-place = cover-letter.at("place", default: "")
  #let letter-date = cover-letter.at("date", default: "")

  #grid(
    columns: (85mm, 1fr),
    gutter: 15mm,
    align: (left + top, right + bottom),
    [
      #block(width: 85mm)[
        #text(size: 7.5pt, fill: rgb("#64748b"))[#ret-line]
        #v(1.5mm)
        #line(length: 85mm, stroke: 0.35pt + rgb("#cbd5e1"))
      ]
      #v(2.5mm)
      #block(width: 85mm)[
        #set text(size: 10pt, fill: rgb("#0f172a"))
        #if recipient-company != "" [ #text(weight: "medium")[#recipient-company] \ ]
        #if recipient-dept != "" [ #recipient-dept \ ]
        #if recipient-contact != "" [ #recipient-contact \ ]
        #if recipient-street != "" [ #recipient-street \ ]
        #if recipient-postal != "" or recipient-city != "" [
          #(recipient-postal + " " + recipient-city) \
        ]
        #if recipient-country != "" and recipient-country != "Deutschland" and recipient-country != "Germany" [
          #recipient-country \
        ]
      ]
    ],
    [
      #set text(size: 10pt, fill: rgb("#334155"))
      #let date-str = (
        if letter-place != "" and letter-date != "" { letter-place + ", " + letter-date }
        else if letter-date != "" { letter-date }
        else { letter-place }
      )
      #if date-str != "" [ #date-str ]
    ]
  )

  #v(8mm)

  // Subject
  #let subject-text = cover-letter.at("subject", default: "")
  #if subject-text != "" [
    #text(size: 12pt, weight: "bold", fill: accent)[#subject-text]
    #v(5mm)
  ]

  // Salutation
  #let salutation-text = cover-letter.at("salutation", default: "")
  #if salutation-text != "" [
    #text(size: 10.5pt, weight: "medium", fill: rgb("#1e293b"))[#salutation-text]
    #v(3mm)
  ]

  // Body
  #let body-text = cover-letter.at("body", default: "")
  #if body-text != "" [
    #for p in body-text.split("\n\n") [
      #let trimmed = p.trim()
      #if trimmed != "" [
        #let lines = trimmed.split("\n")
        #for (i, line-str) in lines.enumerate() [
          #line-str
          #if i < lines.len() - 1 [ \ ]
        ]
        #v(0.65em)
      ]
    ]
  ]

  #v(3mm)

  // Closing & Signature
  #let closing-text = cover-letter.at("closing", default: t("Mit freundlichen Grüßen", "Sincerely,"))
  #block(breakable: false)[
    #text(size: 10.5pt, fill: rgb("#1e293b"))[#closing-text]
    #v(2mm)

    #if signature-file != "" [
      #image(signature-file, height: 18mm, fit: "contain")
      #v(1mm)
    ] else [
      #v(12mm)
    ]

    #let sig-name = cover-letter.at("signatureName", default: sender-name)
    #if sig-name != "" [
      #text(size: 10.5pt, weight: "medium", fill: rgb("#0f172a"))[#sig-name]
    ]
  ]

  #let attachments-note = cover-letter.at("attachmentsNote", default: "")
  #if attachments-note != "" [
    #v(8mm)
    #block(breakable: false)[
      #text(size: 9.5pt, weight: "bold", fill: rgb("#475569"))[#t("Anlagen", "Attachments")]
      #v(1mm)
      #text(size: 9pt, fill: rgb("#64748b"))[#attachments-note]
    ]
  ]

  pagebreak()
]

// ==========================================
// 3. LEBENSLAUF (Resume / Curriculum Vitae)
// ==========================================
#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2cm, left: 2.2cm, right: 2.2cm),
  header: none,
  footer: none,
  background: none
)

#set text(
  font: (font-name, "Liberation Sans", "DejaVu Sans", "Arial"),
  size: 9.5pt,
  fill: rgb("#1e293b"),
  lang: lang
)

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
        #if street != none and street != "" [ #street \ ]
        #if postal != none or city != none [ #((postal, city).filter(x => x != none and x != "").join(" ")) ]
      ]],
      [#text(size: 8.5pt, fill: rgb("#64748b"))[
        #let website = data.at("website", default: none)
        #let linkedin = data.at("linkedIn", default: none)
        #let github = data.at("gitHub", default: none)
        #if website != none and website != "" [ #text(weight: "medium")[Web:] #website \ ]
        #if linkedin != none and linkedin != "" [ #text(weight: "medium")[LinkedIn:] #linkedin \ ]
        #if github != none and github != "" [ #text(weight: "medium")[GitHub:] #github ]
      ]]
    )
  ],
  if photo-file != "" and show-photo [
    #let radius = if photo-shape == "round" { 50% } else if photo-shape == "rect" { 0pt } else { 8pt }
    #box(
      width: 75pt,
      height: 95pt,
      radius: radius,
      clip: true,
      stroke: 0.5pt + rgb("#cbd5e1")
    )[
      #image(photo-file, width: 100%, height: 100%, fit: "cover")
    ]
  ]
)

#v(8pt)

// Bio
#let bio = data.at("bio", default: none)
#if bio != none and bio != "" [
  #section-heading(t("Über mich", "Profile"))
  #text(size: 9.5pt, fill: rgb("#334155"))[#bio]
  #v(6pt)
]

// Experience
#let experiences = data.at("experiences", default: ())
#if experiences.len() > 0 [
  #section-heading(t("Berufserfahrung", "Work Experience"))
  #for exp in experiences [
    #let start = exp.at("startDate", default: "")
    #let end = if exp.at("isCurrent", default: false) { t("heute", "present") } else { exp.at("endDate", default: "") }
    #let period = (start, end).filter(x => x != "" and x != none).join(" - ")

    #grid(
      columns: (110pt, 1fr),
      column-gutter: 12pt,
      align: (left + top, left + top),
      [
        #text(size: 8.5pt, fill: rgb("#64748b"), weight: "medium")[#period]
        #let city = exp.at("city", default: none)
        #if city != none and city != "" [ \ #text(size: 8pt, fill: rgb("#94a3b8"))[#city] ]
      ],
      [
        #text(size: 10pt, weight: "bold", fill: rgb("#0f172a"))[#exp.at("jobTitle", default: "")]
        #let employer = exp.at("employer", default: "")
        #if employer != "" [
          #text(size: 9.5pt, fill: rgb("#475569"))[ — #employer]
        ]
        #let desc = exp.at("description", default: none)
        #if desc != none and desc != "" [
          #v(2pt)
          #text(size: 9pt, fill: rgb("#334155"))[#desc]
        ]
      ]
    )
    #v(8pt)
  ]
]

// Education
#let educations = data.at("educations", default: ())
#if educations.len() > 0 [
  #section-heading(t("Ausbildung & Studium", "Education"))
  #for edu in educations [
    #let start = edu.at("startDate", default: "")
    #let end = if edu.at("isCurrent", default: false) { t("heute", "present") } else { edu.at("endDate", default: "") }
    #let period = (start, end).filter(x => x != "" and x != none).join(" - ")

    #grid(
      columns: (110pt, 1fr),
      column-gutter: 12pt,
      align: (left + top, left + top),
      [
        #text(size: 8.5pt, fill: rgb("#64748b"), weight: "medium")[#period]
      ],
      [
        #let degree = edu.at("degree", default: "")
        #let field = edu.at("fieldOfStudy", default: none)
        #let title = if field != none and field != "" { degree + " in " + field } else { degree }
        #text(size: 10pt, weight: "bold", fill: rgb("#0f172a"))[#title]
        #let inst = edu.at("institution", default: "")
        #if inst != "" [ #text(size: 9.5pt, fill: rgb("#475569"))[ — #inst] ]
        #let grade = edu.at("grade", default: none)
        #if grade != none and grade != "" [
          \ #text(size: 8.5pt, fill: rgb("#64748b"))[#(t("Abschlussnote: ", "Grade: ") + grade)]
        ]
      ]
    )
    #v(8pt)
  ]
]

// Skills
#let skills = data.at("skills", default: ())
#if skills.len() > 0 [
  #section-heading(t("Fachliche Kenntnisse", "Skills & Competences"))
  #let skill-names = skills.map(s => s.at("name", default: "")).filter(n => n != "").join(" · ")
  #text(size: 9pt, fill: rgb("#334155"))[#skill-names]
  #v(8pt)
]

// Languages
#let languages = data.at("languages", default: ())
#if languages.len() > 0 [
  #section-heading(t("Sprachkenntnisse", "Languages"))
  #let lang-strs = languages.map(l => {
    let name = l.at("language", default: "")
    let lvl = l.at("level", default: "")
    if lvl != "" { name + " (" + lvl + ")" } else { name }
  }).join(" · ")
  #text(size: 9pt, fill: rgb("#334155"))[#lang-strs]
  #v(8pt)
]

// Certificates
#let certificates = data.at("certificates", default: ())
#if certificates.len() > 0 [
  #section-heading(t("Zertifikate & Weiterbildung", "Certificates"))
  #for cert in certificates [
    #let title = cert.at("title", default: "")
    #let issuer = cert.at("issuer", default: none)
    #let issue-date = cert.at("issueDate", default: none)
    #let line-parts = (title,)
    #if issuer != none and issuer != "" { line-parts.push("(" + issuer + ")") }
    #if issue-date != none and issue-date != "" { line-parts.push("— " + issue-date) }
    #text(size: 9pt, fill: rgb("#334155"))[#line-parts.join(" ")] \
  ]
  #v(8pt)
]

// ==========================================
// 4. ANLAGEN / ATTACHMENTS
// ==========================================
#let attachments = options.at("attachments", default: ())
#if attachments.len() > 0 [
  #for att in attachments [
    #pagebreak()
    #set page(
      paper: "a4",
      margin: (top: 2cm, bottom: 2cm, left: 2cm, right: 2cm),
      header: [
        #align(right)[
          #text(size: 8.5pt, fill: rgb("#94a3b8"))[
            #data.at("firstName", default: "") #data.at("lastName", default: "") · #t("Anlage", "Attachment")
          ]
        ]
      ]
    )

    #let att-title = att.at("title", default: t("Anlage", "Attachment"))
    #text(size: 13pt, weight: "bold", fill: accent)[#att-title]
    #v(3mm)
    #line(length: 100%, stroke: 1pt + rgb("#cbd5e1"))
    #v(5mm)

    #let file-path = att.at("filePath", default: "")
    #if file-path != "" [
      #align(center + horizon)[
        #box(
          stroke: 0.5pt + rgb("#e2e8f0"),
          radius: 4pt,
          clip: true,
          image(file-path, width: 90%)
        )
      ]
    ]
  ]
]

