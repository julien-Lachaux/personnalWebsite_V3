import { type Locale, type SocialLink as SocialLinkResponse } from '@siteperso/contracts';

import { type SocialLinksRepository } from './ports/social-links-repository.port.js';

/** Cas d'usage : liens sociaux publiés, dans l'ordre du dépôt. Classe pure, sans décorateur. */
export class ListSocialLinksUseCase {
  constructor(private readonly socialLinks: SocialLinksRepository) {}

  async execute(locale: Locale): Promise<SocialLinkResponse[]> {
    const links = await this.socialLinks.findAllPublished(locale);
    return links.map((link) => ({
      slug: link.slug,
      kind: link.kind,
      url: link.url,
      label: link.label,
    }));
  }
}
