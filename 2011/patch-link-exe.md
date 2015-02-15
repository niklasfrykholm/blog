# Code Share: Patch link.exe to ignore LNK4099

By default, Visual Studio's *link.exe* does not let you ignore the linker warning [LNK4099](http://msdn.microsoft.com/en-us/library/b7whw3f3v=vs.80.aspx) (PDB file was not found).

This can be a real nuisance when you have to link with third party libraries that reference (but do not come with) PDBs. You can get hundreds of linker warnings that you have no way of getting rid of.

The only way I've found of fixing the problem is to patch *link.exe *so that it allows warning 4099 to be ignored. Luckily, it is not as scary as it sounds. You only need to patch a single location to remove 4099 from a list of warnings that cannot be ignored. An outline of the procedure can be found [here](http://www.bottledlight.com/docs/lnk4099.html).

Following my general philosophy to [write-a-script-for-it](http://altdevblogaday.com/2011/05/11/write-a-script-for-it/) I wrote a short ruby script that does the patching. I'm sharing it here for everybody that want to do voodoo on their *link.exe* and get rid of the warning.

[(Click here for pastebin version.)](http://pastebin.com/RrkbXYZu)

```ruby
# This ruby program will patch the linker executable (link.exe)
# so that linker warning LNK4099 is ignorable.
#
# Reference: http://www.bottledlight.com/docs/lnk4099.html

require "fileutils"

def link_exes()
 res = []
 res << File.join(ENV["VS90COMNTOOLS"], "../../VC/bin/link.exe") if ENV["VS90COMNTOOLS"]
 res << File.join(ENV["VS100COMNTOOLS"], "../../VC/bin/link.exe") if ENV["VS100COMNTOOLS"]
 res << File.join(ENV["XEDK"], "bin/win32/link.exe") if ENV["XEDK"]
 return res
end

def patch_link_exe(exe)
 data = nil
 File.open(exe, "rb") {|f| data = f.read}
 unpatched = [4088, 4099, 4105].pack("III")
 patched = [4088, 65535, 4105].pack("III")

 if data.scan(patched).size > 0
  puts "* Already patched #{exe}"
  return
 end

 num_unpatched = data.scan(unpatched).size
 raise "Multiple patch locations in #{exe}" if num_unpatched > 1
 raise "Patch location not found in #{exe}" if num_unpatched == 0

 offset = data.index(unpatched)
 puts "* Found patch location #{exe}:#{offset}"
 bak = exe + "-" + Time.now.strftime("%y%m%d-%H%M%S") + ".bak"
 puts "  Creating backup #{bak}"
 FileUtils.cp(exe, bak)
 puts "  Patching exe"
 data[offset,unpatched.size] = patched
 File.open(exe, "wb") {|f| f.write(data)}
 return true
end

link_exes.each do |exe|
 patch_link_exe(exe)
end
```