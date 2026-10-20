import { Injectable } from "@nestjs/common";
import { DocumentsRepository } from "./documents.repository";

@Injectable()
export class DocumentTagService {
  constructor(private readonly repo: DocumentsRepository) {}

  list() {
    return this.repo.listTags();
  }

  async apply(documentId: string, names: string[]) {
    const tags = await this.repo.ensureTags(names);
    await this.repo.setTagLinks(
      documentId,
      tags.map((tag) => tag.id),
    );
    return this.repo.update(documentId, { tags });
  }
}
