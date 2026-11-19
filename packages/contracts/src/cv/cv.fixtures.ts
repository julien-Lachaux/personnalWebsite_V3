// Exemples valides partagés par les tests (exclus du build). Contenu fictif : aucune donnée réelle.
import { type Cv } from './cv.js';

export const skillExample = {
  slug: 'typescript',
  name: 'TypeScript',
  level: 5,
  icon: 'typescript',
  iconPath: null,
  groupSlug: 'langages',
};

export const cvExample: Cv = {
  locale: 'fr',
  profile: {
    firstName: 'Prénom',
    lastName: 'Nom',
    location: 'Melun, Île-de-France',
    picture: { path: '/images/profile.webp', alt: 'Portrait de profil' },
    title: 'Développeur full-stack',
    titleBadge: 'senior',
    taglines: ['Première accroche', 'Seconde accroche'],
    intro: 'Introduction.',
    mission: 'Mission.',
    currentActivity: 'Activité du moment.',
    seekingFormat: 'Temps partiel',
    seekingLocation: 'Paris · hybride',
    seekingAvailability: 'Immédiate',
    cvPath: '/cv/cv-fr.pdf',
  },
  socialLinks: [
    { slug: 'github', kind: 'github', url: 'https://github.com/example', label: 'GitHub' },
  ],
  skillGroups: [
    {
      slug: 'langages',
      name: 'Langages',
      description: 'Langages maîtrisés',
      skills: [skillExample],
    },
  ],
  experiences: [
    {
      slug: 'pause-pro',
      kind: 'break',
      company: null,
      companyUrl: null,
      logo: null,
      contractType: null,
      workMode: null,
      dateStart: '2025-01-01',
      dateEnd: null,
      jobTitle: 'Pause professionnelle',
      location: null,
      summary: 'Résumé.',
      achievements: ['Une réalisation'],
      stackLabel: 'Huile de coude',
      skills: [skillExample],
    },
  ],
  projects: [
    {
      slug: 'projet',
      url: 'https://example.com',
      repoUrl: 'https://github.com/example/projet',
      imageDesktop: { path: '/images/projet-desktop.webp', alt: 'Version bureau' },
      imageMobile: null,
      year: 2026,
      title: 'Projet',
      description: 'Description.',
      skills: [skillExample],
    },
  ],
  tools: [
    {
      slug: 'vscode',
      url: 'https://example.com/vscode',
      iconPath: '/icons/vscode.svg',
      name: 'VS Code',
      family: 'IDE',
      description: 'Éditeur.',
    },
  ],
  resources: [
    {
      slug: 'ressource',
      url: 'https://example.com/ressource',
      groupSlug: null,
      picture: null,
      name: 'Ressource',
      description: 'Description.',
    },
  ],
  certifications: [
    { slug: 'certif', issuer: 'Organisme', year: 2024, url: null, name: 'Certification' },
  ],
  education: [
    {
      slug: 'master',
      institution: 'Université',
      yearStart: 2008,
      yearEnd: 2010,
      url: null,
      title: 'Master',
      description: 'Description.',
    },
  ],
  languages: [
    { slug: 'fr', code: 'fr', cefrLevel: null, name: 'Français', levelLabel: 'langue maternelle' },
    { slug: 'en', code: 'en', cefrLevel: 'C1', name: 'Anglais', levelLabel: 'professionnel' },
  ],
};
