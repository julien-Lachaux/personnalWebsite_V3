# Traductions EN à relire

Traductions anglaises proposées par l'agent base de données (lot 1) dans `db/seeds/`. Chaque ligne
correspond à un commentaire `-- EN : à relire` du seed indiqué (une ligne par champ, une par
élément pour les listes `achievements`). Les textes identiques en français et en anglais (noms
propres, noms de technologies, villes) ne sont pas listés. Julien relit, corrige dans le seed
puis retire la ligne et le commentaire correspondants. Aucune traduction n'est définitive avant.

| Fichier | Table | Slug | Champ | Texte FR | Texte EN proposé |
|---|---|---|---|---|---|
| 0001_profile.sql | profile_translations | profile (id 1) | title | Développeur full-stack | Full-stack developer |
| 0001_profile.sql | profile_translations | profile (id 1) | picture_alt | Portrait de Julien Lachaux | Portrait of Julien Lachaux |
| 0001_profile.sql | profile_translations | profile (id 1) | taglines[1] | NestJS, Vue.js — données, ETL et analytics | NestJS, Vue.js — data, ETL and analytics |
| 0001_profile.sql | profile_translations | profile (id 1) | taglines[2] | Développement assisté par IA et agentique | AI-assisted and agentic development |
| 0001_profile.sql | profile_translations | profile (id 1) | intro | Depuis 2017, je conçois des API, des interfaces et des flux de données fiables. Mon fil rouge : faire circuler la donnée entre des systèmes qui ne se parlent pas. | Since 2017, I have been designing APIs, interfaces and reliable data flows. My common thread: making data flow between systems that do not talk to each other. |
| 0001_profile.sql | profile_translations | profile (id 1) | mission | Je souhaite mettre ce savoir-faire au service de structures utiles : associations, ONG, économie sociale et solidaire, écologie, service public. | I want to put this expertise at the service of useful organizations: non-profits, NGOs, the social and solidarity economy, ecology, public service. |
| 0001_profile.sql | profile_translations | profile (id 1) | current_activity | Bénévole 2 jours par semaine : je développe un outil d’aide au parcours de soins en milieu psychiatrique | Volunteering two days a week: I am developing a tool that supports care pathways in psychiatric settings |
| 0001_profile.sql | profile_translations | profile (id 1) | seeking_format | Temps partiel (3 jours par semaine) ou missions freelance courtes | Part-time (3 days a week) or short freelance assignments |
| 0001_profile.sql | profile_translations | profile (id 1) | seeking_location | Paris, Île-de-France · hybride ou à distance | Paris, Île-de-France · hybrid or remote |
| 0001_profile.sql | profile_translations | profile (id 1) | seeking_availability | Immédiate | Immediate |
| 0002_social_links.sql | social_links_translations | linkedin-recommendations | label | Recommandations publiées sur LinkedIn | Recommendations published on LinkedIn |
| 0003_skills.sql | skill_groups_translations | languages-frameworks | name | Langages et frameworks | Languages and frameworks |
| 0003_skills.sql | skill_groups_translations | data-messaging | name | Données et messagerie | Data and messaging |
| 0003_skills.sql | skill_groups_translations | integration-etl | name | Intégration et ETL | Integration and ETL |
| 0003_skills.sql | skill_groups_translations | applied-ai | name | IA appliquée | Applied AI |
| 0003_skills.sql | skill_groups_translations | practices | name | Pratiques | Practices |
| 0003_skills.sql | skills_translations | vuejs | name | Vue.js (2 et 3) | Vue.js (2 and 3) |
| 0003_skills.sql | skills_translations | rest-api | name | API REST | REST API |
| 0003_skills.sql | skills_translations | ecommerce-integrations | name | Intégrations e-commerce | E-commerce integrations |
| 0003_skills.sql | skills_translations | ai-features | name | Intégration de fonctionnalités d'IA | AI feature integration |
| 0003_skills.sql | skills_translations | agentic-development | name | Développement agentique | Agentic development |
| 0003_skills.sql | skills_translations | ai-daily-use | name | Usage quotidien de l'IA en développement | Daily use of AI in development |
| 0003_skills.sql | skills_translations | managed-cloud-deployment | name | Cloud managé | Managed cloud |
| 0003_skills.sql | skills_translations | agile | name | Méthodes agiles | Agile methods |
| 0003_skills.sql | skills_translations | production-operations | name | Diagnostic en production | Production diagnosis |
| 0004_experiences.sql | experiences_translations | nopillo | summary | Intégration de fonctionnalités d'IA dans le produit. | Integration of AI features into the product. |
| 0004_experiences.sql | experiences_translations | nopillo | achievements[1] | Développement d'un système d'OCR pour les tickets de caisse et les factures | Development of an OCR system for receipts and invoices |
| 0004_experiences.sql | experiences_translations | nopillo | achievements[2] | Développement du remplissage automatique des déclarations fiscales | Development of automatic filling of tax returns |
| 0004_experiences.sql | experiences_translations | nopillo | achievements[3] | Participation au cadrage et aux premiers développements d'une IA agentique de recommandation fiscale | Contribution to the scoping and first developments of an agentic AI for tax recommendations |
| 0004_experiences.sql | experiences_translations | nopillo | achievements[4] | Participation au développement des bases du projet en full-stack (front et back, principalement back-end) | Contribution to building the project foundations in full-stack (front end and back end, mostly back end) |
| 0004_experiences.sql | experiences_translations | nopillo | logo_alt | Logo de Nopillo | Nopillo logo |
| 0004_experiences.sql | experiences_translations | pause-professionnelle | job_title | Pause professionnelle | Career break |
| 0004_experiences.sql | experiences_translations | pause-professionnelle | summary | Pause consacrée à un projet immobilier personnel. En parallèle, veille technique active, avec un usage quotidien de l'IA dans ma pratique de développement. | Break devoted to a personal real estate project. Alongside it, active technology watch, with daily use of AI in my development practice. |
| 0004_experiences.sql | experiences_translations | pause-professionnelle | stack_label | Huile de coude | Elbow grease |
| 0004_experiences.sql | experiences_translations | contentsquare | summary | Analyse des écarts de collecte de données entre outils d'analytics, puis développement full-stack dans l'équipe Intégrations. | Analysis of data collection discrepancies between analytics tools, then full-stack development in the Integrations team. |
| 0004_experiences.sql | experiences_translations | contentsquare | achievements[1] | Pendant deux ans, analyse et diagnostic des écarts de collecte de données entre outils d'analytics (Contentsquare, Google Analytics, Adobe Analytics) | For two years, analysis and diagnosis of data collection discrepancies between analytics tools (Contentsquare, Google Analytics, Adobe Analytics) |
| 0004_experiences.sql | experiences_translations | contentsquare | achievements[2] | Conception d'outils internes pour faciliter ce diagnostic au support technique | Design of internal tools to help technical support run this diagnosis |
| 0004_experiences.sql | experiences_translations | contentsquare | achievements[3] | Puis développeur full-stack dans l'équipe Intégrations : back-end TypeScript (NestJS, Kafka, Redis, PostgreSQL), front-end Vue 2 et Vue 3 | Then full-stack developer in the Integrations team: TypeScript back end (NestJS, Kafka, Redis, PostgreSQL), Vue 2 and Vue 3 front end |
| 0004_experiences.sql | experiences_translations | contentsquare | logo_alt | Logo de Contentsquare | Contentsquare logo |
| 0004_experiences.sql | experiences_translations | wynd-integration | job_title | Expert Intégration SI & Flux | Systems Integration and Data Flow Expert |
| 0004_experiences.sql | experiences_translations | wynd-integration | summary | Équipe RUN, en charge de la production et de la maintenance applicative. | RUN team, in charge of production and application maintenance. |
| 0004_experiences.sql | experiences_translations | wynd-integration | achievements[1] | Cadrage et réalisation de chantiers d'intégration du produit : API, front e-commerce (Magento), flux ETL avec le SI des clients | Scoping and delivery of product integration projects: APIs, e-commerce front end (Magento), ETL flows with customers' information systems |
| 0004_experiences.sql | experiences_translations | wynd-integration | achievements[2] | Diagnostic et correction de bugs en production sur toute la stack | Diagnosis and fixing of production bugs across the whole stack |
| 0004_experiences.sql | experiences_translations | wynd-integration | achievements[3] | Référent StreamSets pour l'entreprise | Company reference for StreamSets |
| 0004_experiences.sql | experiences_translations | wynd-integration | logo_alt | Logo de Wynd | Wynd logo |
| 0004_experiences.sql | experiences_translations | wynd-etl | summary | Responsable de StreamSets, l'ETL open source utilisé par l'entreprise. | In charge of StreamSets, the open source ETL used by the company. |
| 0004_experiences.sql | experiences_translations | wynd-etl | achievements[1] | Définition et diffusion des bonnes pratiques | Defining and spreading best practices |
| 0004_experiences.sql | experiences_translations | wynd-etl | achievements[2] | Accompagnement des équipes sur la conception, le déploiement et l'amélioration des flux d'intégration, pour le produit comme pour les projets clients | Coaching teams on the design, deployment and improvement of integration flows, for the product as well as for customer projects |
| 0004_experiences.sql | experiences_translations | wynd-etl | achievements[3] | Industrialisation de l'usage de StreamSets dans l'entreprise | Industrialization of StreamSets use across the company |
| 0004_experiences.sql | experiences_translations | wynd-etl | logo_alt | Logo de Wynd | Wynd logo |
| 0004_experiences.sql | experiences_translations | leboncoin | job_title | Développeur web freelance | Freelance web developer |
| 0004_experiences.sql | experiences_translations | leboncoin | summary | Mission back-end en PHP 7 : nouvelles fonctionnalités pour le back-office et le CRM. | Back-end assignment in PHP 7: new features for the back office and the CRM. |
| 0004_experiences.sql | experiences_translations | leboncoin | logo_alt | Logo de leboncoin | leboncoin logo |
| 0004_experiences.sql | experiences_translations | afluens | job_title | Développeur full-stack | Full-stack developer |
| 0004_experiences.sql | experiences_translations | afluens | summary | Développement de l'outil collaboratif de l'entreprise, de la conception à la production. | Development of the company's collaborative tool, from design to production. |
| 0004_experiences.sql | experiences_translations | afluens | achievements[1] | Nouvelles fonctionnalités et nouveaux écrans, connexions avec des API externes (ERP, routeur e-mail et SMS), exports Excel | New features and screens, connections with external APIs (ERP, e-mail and SMS router), Excel exports |
| 0004_experiences.sql | experiences_translations | afluens | achievements[2] | Refactoring en PHP orienté objet ; monitoring et optimisation du système de fichiers cloud (Node.js) | Refactoring to object-oriented PHP; monitoring and optimization of the cloud file system (Node.js) |
| 0004_experiences.sql | experiences_translations | afluens | achievements[3] | Exploitation : maintien du service, administration du serveur, gestion des incidents, support de niveau 2 | Operations: keeping the service running, server administration, incident management, level 2 support |
| 0004_experiences.sql | experiences_translations | afluens | logo_alt | Logo de Afluens | Afluens logo |
| 0004_experiences.sql | experiences_translations | openclassrooms-mentor | job_title | Mentor en développement web | Web development mentor |
| 0004_experiences.sql | experiences_translations | openclassrooms-mentor | location | À distance | Remote |
| 0004_experiences.sql | experiences_translations | openclassrooms-mentor | summary | Mentorat d'étudiants en développement web, avec cours individuels en visioconférence. | Mentoring web development students, with one-to-one video lessons. |
| 0004_experiences.sql | experiences_translations | openclassrooms-mentor | logo_alt | Logo de OpenClassrooms | OpenClassrooms logo |
| 0005_certifications_education_languages.sql | certifications_translations | ef-set-plus-62 | name | EF SET Plus 62, anglais C1 | EF SET Plus 62, English C1 |
| 0005_certifications_education_languages.sql | certifications_translations | openclassrooms-integrateur-web | name | Intégrateur Web | Web Integrator |
| 0005_certifications_education_languages.sql | education_translations | eemi | title | Formation à l'EEMI | Studies at EEMI |
| 0005_certifications_education_languages.sql | education_translations | eemi | description | Quelques mois de formation en 2016. | A few months of training in 2016. |
| 0005_certifications_education_languages.sql | education_translations | openclassrooms-integrateur-web | title | Parcours Intégrateur Web | Web Integrator track |
| 0005_certifications_education_languages.sql | education_translations | autodidacte | title | Formation autodidacte | Self-taught training |
| 0005_certifications_education_languages.sql | education_translations | autodidacte | description | Formation autodidacte au développement web, complétée par des cursus encadrés. | Self-taught web development, complemented by guided courses. |
| 0005_certifications_education_languages.sql | languages_translations | french | name | Français | French |
| 0005_certifications_education_languages.sql | languages_translations | french | level_label | langue maternelle | native language |
| 0005_certifications_education_languages.sql | languages_translations | english | name | Anglais | English |
| 0005_certifications_education_languages.sql | languages_translations | english | level_label | professionnel | professional |
| 0007_ai_overview.sql | ai_overview_translations | ai-overview (id 1) | title | L’IA, dans le produit et au quotidien | AI, in the product and day to day |
| 0007_ai_overview.sql | ai_overview_translations | ai-overview (id 1) | in_product_label | dans le produit · Nopillo, 2026 | in the product · Nopillo, 2026 |
| 0007_ai_overview.sql | ai_overview_translations | ai-overview (id 1) | in_product_items[1] | OCR pour les tickets de caisse et les factures | OCR for receipts and invoices |
| 0007_ai_overview.sql | ai_overview_translations | ai-overview (id 1) | in_product_items[2] | Remplissage automatique des déclarations fiscales | Automatic filling of tax returns |
| 0007_ai_overview.sql | ai_overview_translations | ai-overview (id 1) | in_product_items[3] | Cadrage et premiers développements d’une IA agentique de recommandation fiscale | Scoping and first developments of an agentic AI for tax recommendations |
| 0007_ai_overview.sql | ai_overview_translations | ai-overview (id 1) | daily_label | au quotidien | day to day |
| 0007_ai_overview.sql | ai_overview_translations | ai-overview (id 1) | daily_text | Usage quotidien de l’IA dans ma pratique de développement, développement agentique avec Mastra, veille technique active. | Daily use of AI in my development practice, agentic development with Mastra, active technology watch. |
