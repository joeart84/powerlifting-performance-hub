"""Check ELF LOAD alignments in AAB; Java-only packages need no native relinking."""
import sys,zipfile,struct
errors=[]
with zipfile.ZipFile(sys.argv[1]) as bundle:
    libraries=[p for p in bundle.namelist() if p.endswith('.so')]
    for path in libraries:
        data=bundle.read(path)
        if data[:4]!=b'\x7fELF':errors.append(path+': not ELF');continue
        if '/arm64-v8a/' not in path and '/x86_64/' not in path:continue
        endian='<' if data[5]==1 else '>'
        if data[4]!=2:errors.append(path+': expected ELF64');continue
        offset=struct.unpack_from(endian+'Q',data,32)[0]
        size,count=struct.unpack_from(endian+'HH',data,54)
        for i in range(count):
            header=struct.unpack_from(endian+'IIQQQQQQ',data,offset+i*size)
            if header[0]==1 and header[7]<16384:errors.append(path+': LOAD alignment below 16 KB')
if errors:raise SystemExit('\n'.join(errors))
print(f'ELF check passed: {len(libraries)} native libraries. Bundle packaging and runtime must still be checked in Play pre-launch/device testing.')
