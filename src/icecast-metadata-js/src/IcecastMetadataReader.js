/* Copyright 2020 Ethan Halsall
    This file is part of icecast-metadata-js.

    icecast-metadata-js free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    icecast-metadata-js distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>
*/

const MetadataParser = require("./MetadataParser/MetadataParser");
const IcyMetadataParser = require("./MetadataParser/IcyMetadataParser");
const OggMetadataParser = require("./MetadataParser/OggMetadataParser");
const DualMetadataParser = require("./MetadataParser/DualMetadataParser");

class IcecastMetadataReader {
  constructor({ metadataTypes = ["icy"], ...rest } = {}) {
    const hasIcy = metadataTypes.includes("icy");
    const hasOgg = metadataTypes.includes("ogg");

    if (hasIcy && hasOgg) this._metadataParser = new DualMetadataParser(rest);
    else if (hasOgg) this._metadataParser = new OggMetadataParser(rest);
    else if (hasIcy) this._metadataParser = new IcyMetadataParser(rest);
    else this._metadataParser = new MetadataParser(rest);
  }

  static parseIcyMetadata(string) {
    return IcyMetadataParser.parseIcyMetadata(string);
  }

  *iterator(chunk) {
    yield* this._metadataParser.iterator(chunk);
  }

  readAll(chunk) {
    this._metadataParser.readAll(chunk);
  }

  async *asyncIterator(chunk) {
    return yield* this._metadataParser.asyncIterator(chunk);
  }

  async asyncReadAll(chunk) {
    return this._metadataParser.asyncReadAll(chunk);
  }
}

module.exports = IcecastMetadataReader;
