import { Injectable } from '@nestjs/common';
import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

type SignMdfeXmlInput = {
    xml: string;
    pfxBuffer: Buffer;
    password: string;
};

@Injectable()
export class MdfeXmlSignerService {
    sign(input: SignMdfeXmlInput): string {
        const { privateKeyPem, certificatePem } = this.extractCertificateFromPfx(
            input.pfxBuffer,
            input.password,
        );

        const certificateBase64 = this.normalizeCertificate(certificatePem);

        const signer = new SignedXml({
            privateKey: privateKeyPem,
            publicCert: certificatePem,
            canonicalizationAlgorithm:
                'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
            signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
        });

        signer.addReference({
            xpath: "//*[local-name(.)='infMDFe']",
            transforms: [
                'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
                'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
            ],
            digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
        });

        signer.getKeyInfoContent = () => {
            return `<X509Data><X509Certificate>${certificateBase64}</X509Certificate></X509Data>`;
        };

        signer.computeSignature(input.xml, {
            location: {
                reference: "//*[local-name(.)='infMDFe']",
                action: 'after',
            },
        });

        return signer.getSignedXml();
    }

    private extractCertificateFromPfx(pfxBuffer: Buffer, password: string) {
        const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

        const keyBags =
            p12.getBags({
                bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
            })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];

        const certBags =
            p12.getBags({
                bagType: forge.pki.oids.certBag,
            })[forge.pki.oids.certBag] ?? [];

        const keyBag = keyBags[0];
        const certBag = certBags[0];

        if (!keyBag?.key || !certBag?.cert) {
            throw new Error('Certificado A1 inválido ou senha incorreta.');
        }

        return {
            privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
            certificatePem: forge.pki.certificateToPem(certBag.cert),
        };
    }

    private normalizeCertificate(certificatePem: string): string {
        return certificatePem
            .replace('-----BEGIN CERTIFICATE-----', '')
            .replace('-----END CERTIFICATE-----', '')
            .replace(/\r?\n|\r/g, '')
            .trim();
    }
}